package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/chromedp/chromedp"
	"github.com/streadway/amqp"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type ArticleExtended struct {
	Title           string
	Link            string
	Authors         []string
	PublicationDate string
	Journal         string
	Volume          string
	Issue           string
	Pages           string
	Publisher       string
	Description     string
	TotalCitations  int
	PublicationLink string
	PDFLink         string
}

type ArticleScraper struct {
	rabbitMQConn *amqp.Connection
	channel      *amqp.Channel
	queue        amqp.Queue
	queue1       amqp.Queue
}

func NewArticleScraper(rabbitMQURL string) (*ArticleScraper, error) {
	conn, err := amqp.Dial(rabbitMQURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		return nil, fmt.Errorf("failed to open a channel: %w", err)
	}

	q, err := ch.QueueDeclare(
		"researcher-queue",
		true,
		false,
		false,
		false,
		nil,
	)
	q1, err := ch.QueueDeclare(
		"calculations-queue",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to declare a queue: %w", err)
	}

	return &ArticleScraper{
		rabbitMQConn: conn,
		channel:      ch,
		queue:        q,
		queue1:       q1,
	}, nil
}

func (as *ArticleScraper) Close() {
	as.channel.Close()
	as.rabbitMQConn.Close()
}

func (as *ArticleScraper) getIndividualArticleData(articleLink string) (*ArticleExtended, error) {
	ctx, cancel := chromedp.NewContext(context.Background())
	defer cancel()

	var content string
	err := chromedp.Run(ctx,
		chromedp.Navigate(articleLink),
		chromedp.WaitReady("body"),
		chromedp.OuterHTML("html", &content),
	)
	if err != nil {
		return nil, err
	}

	doc, err := goquery.NewDocumentFromReader(strings.NewReader(content))
	if err != nil {
		return nil, err
	}

	title := doc.Find("#gsc_oci_title").Text()
	authors := strings.Split(doc.Find(".gsc_oci_value").First().Text(), ", ")
	publicationDate := doc.Find(`.gsc_oci_field:contains("Publication date")`).Next().Text()
	journal := doc.Find(`.gsc_oci_field:contains("Journal")`).Next().Text()
	volume := doc.Find(`.gsc_oci_field:contains("Volume")`).Next().Text()
	issue := doc.Find(`.gsc_oci_field:contains("Issue")`).Next().Text()
	pages := doc.Find(`.gsc_oci_field:contains("Pages")`).Next().Text()
	publisher := doc.Find(`.gsc_oci_field:contains("Publisher")`).Next().Text()
	description := doc.Find("#gsc_oci_descr .gsh_csp").Text()
	totalCitationsText := doc.Find(`.gsc_oci_value a[href*="cites"]`).First().Text()
	totalCitations := 0
	if matches := regexp.MustCompile(`\d+`).FindString(totalCitationsText); matches != "" {
		totalCitations, _ = strconv.Atoi(matches)
	}
	publicationLink, _ := doc.Find(`.gsc_oci_merged_snippet a[href*="cluster"]`).First().Attr("href")
	pdfLink, exists := doc.Find(`.gsc_oci_title_ggi a[href*="pdf"]`).First().Attr("href")
	if !exists {
		pdfLink = "No PDF available"
	}

	return &ArticleExtended{
		Title:           strings.TrimSpace(title),
		Link:            articleLink,
		Authors:         authors,
		PublicationDate: strings.TrimSpace(publicationDate),
		Journal:         strings.TrimSpace(journal),
		Volume:          strings.TrimSpace(volume),
		Issue:           strings.TrimSpace(issue),
		Pages:           strings.TrimSpace(pages),
		Publisher:       strings.TrimSpace(publisher),
		Description:     strings.TrimSpace(description),
		TotalCitations:  totalCitations,
		PublicationLink: fmt.Sprintf("https://scholar.google.com%s", publicationLink),
		PDFLink:         pdfLink,
	}, nil
}

func (as *ArticleScraper) scrapeArticles(userId string, articlePagination bool) ([]ArticleExtended, error) {
	var articles []ArticleExtended
	var wg sync.WaitGroup
	var mu sync.Mutex

	ctx, cancel := chromedp.NewContext(context.Background())
	defer cancel()

	pageNumber := 1
	hasNextPage := true

	for hasNextPage {
		var content string
		err := chromedp.Run(ctx,
			chromedp.Navigate(fmt.Sprintf("https://scholar.google.com/citations?user=%s&hl=en&gl=us&pagesize=100", userId)),
			chromedp.WaitReady("body"),
			chromedp.OuterHTML("html", &content),
		)
		if err != nil {
			return nil, err
		}

		doc, err := goquery.NewDocumentFromReader(strings.NewReader(content))
		if err != nil {
			return nil, err
		}

		articleLinks := make([]string, 0)
		doc.Find(".gsc_a_tr").Each(func(i int, s *goquery.Selection) {
			articleLink, _ := s.Find(".gsc_a_at").Attr("href")
			articleLinks = append(articleLinks, fmt.Sprintf("https://scholar.google.com%s", articleLink))
		})

		for _, link := range articleLinks {
			wg.Add(1)
			go func(link string) {
				defer wg.Done()
				articleData, err := as.getIndividualArticleData(link)
				if err != nil {
					log.Printf("Failed to get article data: %v", err)
					return
				}
				mu.Lock()
				articles = append(articles, *articleData)
				mu.Unlock()
			}(link)
		}

		wg.Wait()

		hasNextPage = articlePagination && doc.Find(".gsc_a_e").Length() > 0
		if hasNextPage {
			pageNumber += 100
			err = chromedp.Run(ctx,
				chromedp.Navigate(fmt.Sprintf("https://scholar.google.com/citations?user=%s&hl=en&gl=us&cstart=%d&pagesize=100", userId, pageNumber)),
				chromedp.WaitReady("body"),
				chromedp.OuterHTML("html", &content),
			)
			if err != nil {
				return nil, err
			}
		}
	}

	return articles, nil
}

func (as *ArticleScraper) PublishToRabbitMQ(researcherID, adminID string) error {
	message := struct {
		ResearcherID string `json:"researcher_id"`
		AdminID      string `json:"admin_id"`
	}{
		ResearcherID: researcherID,
		AdminID:      adminID,
	}

	body, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	log.Printf("Publishing message to calculation queue: %s", body)

	err = as.channel.Publish(
		"",
		"calculations-queue", // Change this to your actual calculation queue name
		false,
		false,
		amqp.Publishing{
			ContentType: "application/json",
			Body:        body,
		},
	)
	if err != nil {
		return fmt.Errorf("failed to publish a message: %w", err)
	}

	return nil
}

type Paper struct {
	Researcher struct {
		ResearcherID primitive.ObjectID `bson:"researcher_id"`
		Name         string             `bson:"name"`
		ScholarID    string             `bson:"scholar_id"`
	} `bson:"researcher"`
	AdminID         primitive.ObjectID `bson:"admin_id"`
	Title           string             `bson:"title"`
	Link            string             `bson:"link"`
	Authors         []string           `bson:"authors"`
	PublicationDate string             `bson:"publicationDate"`
	Journal         string             `bson:"journal"`
	Volume          string             `bson:"volume"`
	Issue           string             `bson:"issue"`
	Pages           string             `bson:"pages"`
	Publisher       string             `bson:"publisher"`
	Description     string             `bson:"description"`
	TotalCitations  int                `bson:"totalCitations"`
	PublicationLink string             `bson:"publicationLink"`
	PDFLink         string             `bson:"pdfLink"`
	Tags            []string           `bson:"tags"`
	LastFetch       time.Time          `bson:"lastFetch"`
}

func saveArticlesToMongoDB(articles []ArticleExtended, message struct {
	AdminID    string `json:"admin_id"`
	Researcher struct {
		ResearcherID string `json:"researcher_id"`
		Name         string `json:"name"`
		ScholarID    string `json:"scholar_id"`
	} `json:"researcher"`
}) error {

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	client, err := mongo.Connect(ctx, options.Client().ApplyURI("mongodb://localhost:27017/capstone"))
	if err != nil {
		return err
	}
	defer client.Disconnect(ctx)

	collection := client.Database("capstone").Collection("paper")

	adminID, err := primitive.ObjectIDFromHex(message.AdminID)
	if err != nil {
		return err
	}
	researcherID, err := primitive.ObjectIDFromHex(message.Researcher.ResearcherID)
	if err != nil {
		return err
	}

	for _, article := range articles {
		paper := Paper{
			Researcher: struct {
				ResearcherID primitive.ObjectID `bson:"researcher_id"`
				Name         string             `bson:"name"`
				ScholarID    string             `bson:"scholar_id"`
			}{
				ResearcherID: researcherID,
				Name:         message.Researcher.Name,
				ScholarID:    message.Researcher.ScholarID,
			},
			AdminID:         adminID,
			Title:           article.Title,
			Link:            article.Link,
			Authors:         article.Authors,
			PublicationDate: article.PublicationDate,
			Journal:         article.Journal,
			Volume:          article.Volume,
			Issue:           article.Issue,
			Pages:           article.Pages,
			Publisher:       article.Publisher,
			Description:     article.Description,
			TotalCitations:  article.TotalCitations,
			PublicationLink: article.PublicationLink,
			PDFLink:         article.PDFLink,
			Tags:            []string{},
			LastFetch:       time.Now(),
		}

		// Insert the paper into MongoDB
		_, err = collection.InsertOne(ctx, paper)
		if err != nil {
			log.Printf("Error inserting paper %s: %v", paper.Title, err)
		}
	}

	return nil
}

func main() {
	rabbitMQURL := "amqp://guest:guest@localhost:5672/"
	scraper, err := NewArticleScraper(rabbitMQURL)
	if err != nil {
		log.Fatalf("Failed to initialize ArticleScraper: %v", err)
	}
	defer scraper.Close()
	msgs, err := scraper.channel.Consume(
		scraper.queue.Name,
		"",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		log.Fatalf("Failed to register a consumer: %v", err)
	}

	forever := make(chan bool)

	go func() {
		for d := range msgs {
			var message struct {
				AdminID    string `json:"admin_id"`
				Researcher struct {
					ResearcherID string `json:"researcher_id"`
					Name         string `json:"name"`
					ScholarID    string `json:"scholar_id"`
				} `json:"researcher"`
			}

			if err := json.Unmarshal(d.Body, &message); err != nil {
				log.Printf("Failed to unmarshal JSON: %v", err)
				continue
			}

			scholarID := message.Researcher.ScholarID
			log.Printf("Received Scholar ID: %s", scholarID)

			articles, err := scraper.scrapeArticles(scholarID, true)
			if err != nil {
				log.Printf("Failed to scrape articles for scholar_id %s: %v", scholarID, err)
				continue
			}

			err = saveArticlesToMongoDB(articles, message)
			if err != nil {
				log.Printf("Error saving articles to MongoDB: %v", err)
			}
			err = scraper.PublishToRabbitMQ(message.Researcher.ResearcherID, message.AdminID)
			if err != nil {
				log.Printf("Error publishing to calculation queue: %v", err)
			}
		}
	}()

	log.Println("Waiting for messages. To exit press CTRL+C")
	<-forever
}

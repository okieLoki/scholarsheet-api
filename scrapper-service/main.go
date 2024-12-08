package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/chromedp/chromedp"
)

type PublicationDetails struct {
	Title           string `json:"title"`
	Authors         string `json:"authors"`
	PublicationDate string `json:"publication_date"`
	Journal         string `json:"journal"`
	Volume          string `json:"volume"`
	Issue           string `json:"issue"`
	Pages           string `json:"pages"`
	Publisher       string `json:"publisher"`
	Description     string `json:"description"`
	TotalCitations  string `json:"total_citations"`
	PDFLink         string `json:"pdf_link"`
}

func fetchPublicationDetails(publicationLink string) (*PublicationDetails, error) {
	ctx, cancel := chromedp.NewContext(context.Background())
	defer cancel()

	var htmlContent string
	if err := chromedp.Run(ctx,
		chromedp.Navigate(publicationLink),
		chromedp.WaitReady(`body`),
		chromedp.OuterHTML("html", &htmlContent),
	); err != nil {
		return nil, fmt.Errorf("failed to fetch page content: %v", err)
	}

	doc, err := goquery.NewDocumentFromReader(strings.NewReader(htmlContent))
	if err != nil {
		return nil, fmt.Errorf("failed to parse HTML: %v", err)
	}

	extractTextByField := func(fieldName string) string {
		var value string
		doc.Find(".gs_scl").Each(func(i int, s *goquery.Selection) {
			if s.Find(".gsc_oci_field").Text() == fieldName {
				value = s.Find(".gsc_oci_value").Text()
			}
		})
		return value
	}

	return &PublicationDetails{
		Title:           doc.Find("#gsc_oci_title").Text(),
		Authors:         extractTextByField("Authors"),
		PublicationDate: extractTextByField("Publication date"),
		Journal:         extractTextByField("Journal"),
		Volume:          extractTextByField("Volume"),
		Issue:           extractTextByField("Issue"),
		Pages:           extractTextByField("Pages"),
		Publisher:       extractTextByField("Publisher"),
		Description:     doc.Find("#gsc_oci_descr").Text(),
		TotalCitations:  extractTextByField("Total citations"),
		PDFLink:         doc.Find("#gsc_vcpb .gsc_oci_title_ggi a").AttrOr("href", "N/A"),
	}, nil
}

func fetchAllPublicationDetails(authorID string) ([]PublicationDetails, error) {
	var allDetails []PublicationDetails
	baseURL := fmt.Sprintf("https://scholar.google.co.in/citations?user=%s&hl=en", authorID)
	startIndex := 0
	var wg sync.WaitGroup
	detailsChan := make(chan *PublicationDetails)
	errorChan := make(chan error)

	for {
		url := fmt.Sprintf("%s&cstart=%d&pagesize=100", baseURL, startIndex)
		fmt.Printf("Visiting: %s\n", url)

		ctx, cancel := chromedp.NewContext(context.Background())
		defer cancel()

		var htmlContent string
		if err := chromedp.Run(ctx,
			chromedp.Navigate(url),
			chromedp.WaitReady(`body`),
			chromedp.OuterHTML("html", &htmlContent),
		); err != nil {
			return nil, fmt.Errorf("failed to fetch page content: %v", err)
		}

		doc, err := goquery.NewDocumentFromReader(strings.NewReader(htmlContent))
		if err != nil {
			return nil, fmt.Errorf("failed to parse HTML: %v", err)
		}

		links := []string{}
		doc.Find("#gsc_a_b .gsc_a_t a").Each(func(i int, s *goquery.Selection) {
			href, exists := s.Attr("href")
			if exists {
				links = append(links, "https://scholar.google.com"+href)
			}
		})

		if len(links) == 0 {
			break
		}

		for _, link := range links {
			wg.Add(1)
			go func(link string) {
				defer wg.Done()
				details, err := fetchPublicationDetails(link)
				if err != nil {
					errorChan <- err
					return
				}
				detailsChan <- details
			}(link)
		}

		startIndex += 100
	}

	go func() {
		wg.Wait()
		close(detailsChan)
		close(errorChan)
	}()

	for {
		select {
		case details, ok := <-detailsChan:
			if ok {
				allDetails = append(allDetails, *details)
			}
		case err, ok := <-errorChan:
			if ok {
				log.Printf("Error fetching details: %v\n", err)
			}
		case <-time.After(10 * time.Second):
			return allDetails, nil
		}
	}
}

func main() {
	authorID := "MNj1Dw4AAAAJ"
	publicationDetails, err := fetchAllPublicationDetails(authorID)
	if err != nil {
		log.Fatalf("Error fetching publication details: %v", err)
	}

	file, err := os.Create("publication_details.json")
	if err != nil {
		log.Fatalf("Failed to create JSON file: %v", err)
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(publicationDetails); err != nil {
		log.Fatalf("Failed to write to JSON file: %v", err)
	}

	fmt.Printf("Total Publications Found: %d\n", len(publicationDetails))
}

export const adminStatshtmlReport = (
  year,
  department,
  generationTime,
  currentYear,
  cardStats,
  topResearchers,
  rankData,
  analyticsGraphTotalPapers,
  analyticsGraphTotalCitations,
  researchTopics,
  journalDiversity,
  genderDistribution
) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scholar Sheet Admin Stats Report ${year ? year : "(Overall)"}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        }

        body {
        font-family: 'Arial', sans-serif;
        line-height: 1.6;
        color: #333;
        background-color: #f8f9fa;
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
        }

        header {
        text-align: center;
        padding: 30px 0;
        border-bottom: 2px solid #e9ecef;
        margin-bottom: 40px;
        background-color: #fff;
        }

        .logo {
        font-size: 2.5em;
        font-weight: bold;
        color: #0056b3;
        margin-bottom: 10px;
        }

        h1, h2, h3 {
        color: #0056b3;
        }

        h1 {
        font-size: 2.2em;
        margin-bottom: 10px;
        }

        h2 {
        font-size: 1.8em;
        border-bottom: 2px solid #e9ecef;
        padding-bottom: 10px;
        margin-top: 40px;
        margin-bottom: 20px;
        }

        h3 {
        font-size: 1.4em;
        margin-bottom: 10px;
        }

        p.department {
        font-size: 1.2em;
        color: #495057;
        }

        .meta-info {
        font-size: 0.9em;
        color: #6c757d;
        margin-top: 10px;
        }

        .chart-container {
        width: 100%;
        max-width: 800px;
        margin: 30px auto;
        background-color: #fff;
        padding: 20px;
        border: 1px solid #e9ecef;
        }

        .pie-chart-container {
        width: 100%;
        max-width: 600px;
        margin: 30px auto;
        }

        table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 30px;
        background-color: #fff;
        border: 1px solid #e9ecef;
        }

        th, td {
        border-bottom: 1px solid #e9ecef;
        padding: 12px 15px;
        text-align: left;
        }

        th {
        background-color: #0056b3;
        color: #fff;
        font-weight: bold;
        text-transform: uppercase;
        font-size: 0.9em;
        }

        tr:nth-child(even) {
        background-color: #f8f9fa;
        }

        .stat-cards {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        margin-bottom: 40px;
        }

        .stat-card {
        background-color: #fff;
        border: 1px solid #e9ecef;
        padding: 20px;
        margin-bottom: 20px;
        flex-basis: calc(50% - 10px);
        }

        .stat-value {
        font-size: 2.2em;
        font-weight: bold;
        color: #0056b3;
        }

        .stat-comparison {
        font-size: 0.9em;
        color: #6c757d;
        }

        @media (max-width: 768px) {
        body {
            padding: 10px;
        }

        h1 {
            font-size: 2em;
        }

        h2 {
            font-size: 1.6em;
        }

        .stat-card {
            flex-basis: 100%;
        }
        }
            </style>
</head>
<body>
  <header>
    <div class="logo">Scholar Sheet</div>
    <h1>Admin Stats Report ${year ? year : "(Overall)"}</h1>
    <p class="department">Department: ${
      department?.toUpperCase() || "All Departments"
    }</p>
    <p class="meta-info">Generated on: ${generationTime}</p>
  </header>
  
  <section>
    <h2>Key Statistics</h2>
    <div class="stat-cards">
      <div class="stat-card">
        <h3>Citations (${currentYear})</h3>
        <div class="stat-value">${cardStats.citations[currentYear]}</div>
        <div class="stat-comparison">Previous Year: ${
          cardStats.citations[currentYear - 1]
        } | Growth: ${cardStats.citations.growth.toFixed(2)}%</div>
      </div>
      <div class="stat-card">
        <h3>Publications (${currentYear})</h3>
        <div class="stat-value">${cardStats.publications[currentYear]}</div>
        <div class="stat-comparison">Previous Year: ${
          cardStats.publications[currentYear - 1]
        } | Growth: ${cardStats.publications.growth.toFixed(2)}%</div>
      </div>
      <div class="stat-card">
        <h3>Total Papers</h3>
        <div class="stat-value">${cardStats.totalPapers}</div>
      </div>
      <div class="stat-card">
        <h3>Total Researchers</h3>
        <div class="stat-value">${cardStats.totalResearchers}</div>
      </div>
    </div>
  </section>
  
  <section>
    <h2>Publications Over Time</h2>
    <div class="chart-container">
      <canvas id="analyticsChartTotalPapers"></canvas>
    </div>
  </section>

  <section>
    <h2>Citations Over Time</h2>
    <div class="chart-container">
      <canvas id="analyticsChartTotalCitations"></canvas>
    </div>
  </section>
  
  <section>
    <h2>Top Researchers</h2>
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Department</th>
          <th>Total Papers</th>
          <th>Total Citations</th>
          <th>H-Index</th>
          <th>I10-Index</th>
        </tr>
      </thead>
      <tbody>
        ${topResearchers.researchers
          .map(
            (r) => `
          <tr>
            <td>${r.name}</td>
            <td>${r.department}</td>
            <td>${r.totalPapers}</td>
            <td>${r.totalCitations}</td>
            <td>${r.hIndex}</td>
            <td>${r.i10index}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  </section>
  
  <section>
    <h2>Research Topics</h2>
    <div class="pie-chart-container">
      <canvas id="topicsChart"></canvas>
    </div>
  </section>
  
  <section>
    <h2>Journal Diversity</h2>
    <div class="chart-container">
      <canvas id="journalsChart"></canvas>
    </div>
  </section>
  
  <section>
    <h2>Institutional Ranking</h2>
    <div class="stat-cards">
      <div class="stat-card">
        <h3>Total Papers Rank</h3>
        <div class="stat-value">${rankData.totalPapersRank + 1}</div>
      </div>
      <div class="stat-card">
        <h3>Total Citations Rank</h3>
        <div class="stat-value">${rankData.totalCitationsRank + 1}</div>
      </div>
    </div>
  </section>
  
  <section>
    <h2>Gender Distribution</h2>
    <div class="pie-chart-container">
      <canvas id="genderChart"></canvas>
    </div>
  </section>
  
  <script>
    const primaryColor = '#3498db';
    const secondaryColor = '#2c3e50';
    const accentColor = '#95a5a6';

    new Chart(document.getElementById('analyticsChartTotalPapers'), {
      type: 'line',
      data: {
        labels: ${JSON.stringify(Object.keys(analyticsGraphTotalPapers))},
        datasets: [{
          label: 'Publications',
          data: ${JSON.stringify(Object.values(analyticsGraphTotalPapers))},
          borderColor: primaryColor,
          backgroundColor: 'rgba(52, 152, 219, 0.2)',
          tension: 0.3,
          fill: true,
          pointBackgroundColor: primaryColor,
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: primaryColor,
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            labels: {
              color: secondaryColor
            }
          },
          title: {
            display: true,
            text: 'Publications Over Time',
            color: secondaryColor,
            font: {
              size: 18
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: secondaryColor
            },
            grid: {
              color: '#e0e0e0'
            }
          },
          y: {
            ticks: {
              color: secondaryColor
            },
            grid: {
              color: '#e0e0e0'
            },
            beginAtZero: true
          }
        }
      }
    });

    new Chart(document.getElementById('analyticsChartTotalCitations'), {
      type: 'line',
      data: {
        labels: ${JSON.stringify(Object.keys(analyticsGraphTotalCitations))},
        datasets: [{
          label: 'Citations',
          data: ${JSON.stringify(Object.values(analyticsGraphTotalCitations))},
          borderColor: primaryColor,
          backgroundColor: 'rgba(52, 152, 219, 0.2)',
          tension: 0.3,
          fill: true,
          pointBackgroundColor: primaryColor,
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: primaryColor,
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            labels: {
              color: secondaryColor
            }
          },
          title: {
            display: true,
            text: 'Citations Over Time',
            color: secondaryColor,
            font: {
              size: 18
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: secondaryColor
            },
            grid: {
              color: '#e0e0e0'
            }
          },
          y: {
            ticks: {
              color: secondaryColor
            },
            grid: {
              color: '#e0e0e0'
            },
            beginAtZero: true
          }
        }
      }
    });
    
    new Chart(document.getElementById('topicsChart'), {
      type: 'pie',
      data: {
        labels: ${JSON.stringify(
          researchTopics.slice(0, 10).map((t) => t._id)
        )},
        datasets: [{
          data: ${JSON.stringify(
            researchTopics.slice(0, 10).map((t) => t.count)
          )},
          backgroundColor: [
            '#3498db', '#2ecc71', '#e74c3c', '#9b59b6', '#f1c40f',
            '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#d35400'
          ],
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: secondaryColor
            }
          },
          title: {
            display: true,
            text: 'Top 10 Research Topics',
            color: secondaryColor,
            font: {
              size: 18
            }
          }
        }
      }
    });
    
    new Chart(document.getElementById('journalsChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(
          journalDiversity.slice(0, 10).map((j) => j._id)
        )},
        datasets: [{
          label: 'Publications',
          data: ${JSON.stringify(
            journalDiversity.slice(0, 10).map((j) => j.count)
          )},
          backgroundColor: primaryColor,
          borderColor: '#2980b9',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Top 10 Journals',
            color: secondaryColor,
            font: {
              size: 18
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: secondaryColor,
              maxRotation: 45,
              minRotation: 45
            },
            grid: {
              color: '#e0e0e0'
            }
          },
          y: {
          ticks: {
            color: secondaryColor
          },
          grid: {
            color: '#e0e0e0'
          },
          beginAtZero: true
        }
      }
    }
  });
  
  new Chart(document.getElementById('genderChart'), {
    type: 'doughnut',
    data: {
      labels: ${JSON.stringify(Object.keys(genderDistribution.distribution))},
      datasets: [{
        data: ${JSON.stringify(Object.values(genderDistribution.distribution))},
        backgroundColor: [
          '#3498db',
          '#e74c3c',
          '#95a5a6'
        ],
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: secondaryColor
          }
        },
        title: {
          display: true,
          text: 'Gender Distribution',
          color: secondaryColor,
          font: {
            size: 18
          }
        }
      }
    }
  });
</script>
</body>
</html>
`;

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
import time
import random
from datetime import datetime
from typing import List, Dict
from config import SOURCES
from groq_processor import structure_job_data, extract_location_coordinates
from github_db import GitHubDB

class JobScraper:
    def __init__(self):
        self.db = GitHubDB()
        self.results: List[Dict] = []
        
    def scrape_linkedin(self, search_term: str = "sustainability", location: str = "United States"):
        """Scrape LinkedIn jobs (respectful rate limiting)"""
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            )
            page = context.new_page()
            
            url = f"{SOURCES['linkedin']['url']}?keywords={search_term}&location={location}"
            print(f"Scraping: {url}")
            
            try:
                page.goto(url, wait_until="networkidle")
                time.sleep(3)  # Allow dynamic content to load
                
                # Scroll to load more jobs
                for _ in range(3):
                    page.keyboard.press("End")
                    time.sleep(2)
                
                html = page.content()
                soup = BeautifulSoup(html, "html.parser")
                
                jobs = soup.select(SOURCES["linkedin"]["selectors"]["job_cards"])
                print(f"Found {len(jobs)} job cards")
                
                for job in jobs[:5]:  # Limit to 5 per run for rate limiting
                    try:
                        title = job.select_one(SOURCES["linkedin"]["selectors"]["title"]).text.strip() if job.select_one(SOURCES["linkedin"]["selectors"]["title"]) else ""
                        company = job.select_one(SOURCES["linkedin"]["selectors"]["company"]).text.strip() if job.select_one(SOURCES["linkedin"]["selectors"]["company"]) else ""
                        loc = job.select_one(SOURCES["linkedin"]["selectors"]["location"]).text.strip() if job.select_one(SOURCES["linkedin"]["selectors"]["location"]) else ""
                        link = job.select_one(SOURCES["linkedin"]["selectors"]["link"])["href"] if job.select_one(SOURCES["linkedin"]["selectors"]["link"]) else ""
                        
                        raw_text = f"{title} at {company} in {loc}. Job posting from LinkedIn."
                        
                        # Use Groq to structure
                        structured = structure_job_data(raw_text, link)
                        if structured:
                            structured["postedAt"] = datetime.now().isoformat()
                            structured["source"] = "linkedin"
                            
                            # Get coordinates (in production, use a geocoding API like OpenCage)
                            if structured["location"]["city"]:
                                lat, lng = extract_location_coordinates(
                                    structured["location"]["address"],
                                    structured["location"]["city"],
                                    structured["location"]["country"] or "USA"
                                )
                                structured["location"]["lat"] = lat
                                structured["location"]["lng"] = lng
                            
                            self.db.save_job(structured)
                            time.sleep(1)  # Rate limiting between Groq calls
                            
                    except Exception as e:
                        print(f"Error processing job: {e}")
                        continue
                        
            finally:
                browser.close()
    
    def run(self):
        """Main execution flow"""
        print("Starting Job Scraper...")
        
        # Scrape LinkedIn for sustainability jobs
        self.scrape_linkedin("sustainability")
        self.scrape_linkedin("renewable energy")
        self.scrape_linkedin("environmental")
        
        print("Scraping complete!")

if __name__ == "__main__":
    scraper = JobScraper()
    scraper.run()
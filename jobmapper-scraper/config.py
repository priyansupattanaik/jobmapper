import os
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
REPO_OWNER = os.getenv("GITHUB_OWNER")
REPO_NAME = os.getenv("GITHUB_REPO")
BRANCH = os.getenv("GITHUB_BRANCH", "main")

SOURCES = {
    "linkedin": {
        "url": "https://www.linkedin.com/jobs/search",
        "selectors": {
            "job_cards": ".job-search-card",
            "title": ".base-search-card__title",
            "company": ".base-search-card__subtitle",
            "location": ".job-search-card__location",
            "link": "a.base-card__full-link"
        }
    },
    "green_jobs": {
        "url": "https://www.greenjobs.com/search",
        "selectors": {
            "job_cards": ".job-listing",
            "title": ".job-title",
            "company": ".company-name",
            "location": ".location",
            "link": "a.job-link"
        }
    }
}

JOB_TEMPLATES = {
    "title": "",
    "company": "",
    "location": {
        "lat": 0.0,
        "lng": 0.0,
        "address": "",
        "city": "",
        "country": "",
        "postalCode": ""
    },
    "description": "",
    "requirements": [],
    "employmentType": "full-time",
    "remotePolicy": "on-site",
    "tags": [],
    "source": "",
    "applicationUrl": "",
    "status": "active"
}
from groq import Groq
import json
import os
from typing import Dict, List
from config import GROQ_API_KEY

client = Groq(api_key=GROQ_API_KEY)

def structure_job_data(raw_text: str, source_url: str) -> Dict:
    """
    Use Groq API to extract structured job data from scraped text
    """
    prompt = f"""Extract job information from the following text and return a JSON object.
    Text: {raw_text}
    
    Return this exact JSON structure:
    {{
        "title": "Job Title",
        "company": "Company Name",
        "location": {{
            "address": "Full street address or 'Remote' if applicable",
            "city": "City name",
            "country": "Country name",
            "postalCode": "Postal code if available"
        }},
        "description": "Brief 2-3 sentence summary",
        "requirements": ["requirement 1", "requirement 2"],
        "employmentType": "full-time|part-time|contract|freelance",
        "remotePolicy": "on-site|hybrid|remote",
        "tags": ["Skill1", "Skill2", "Industry"],
        "salary": {{
            "min": 50000,
            "max": 80000,
            "currency": "USD",
            "period": "year"
        }}
    }}
    
    Only return the JSON, no other text."""
    
    try:
        response = client.chat.completions.create(
            model="llama3-8b-8192",
            messages=[
                {"role": "system", "content": "You are a precise job data extractor. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=1024
        )
        
        content = response.choices[0].message.content.strip()
        # Extract JSON if wrapped in code blocks
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
            
        data = json.loads(content)
        data["applicationUrl"] = source_url
        data["postedAt"] = None  # Will be set in main scraper
        data["status"] = "active"
        data["id"] = f"job_{hash(source_url) % 10000000:07d}"
        
        return data
    except Exception as e:
        print(f"Error processing with Groq: {e}")
        return None

def extract_location_coordinates(address: str, city: str, country: str) -> tuple:
    """
    Use Groq to estimate coordinates from location text (as a fallback to geocoding API)
    """
    prompt = f"""What are the approximate latitude and longitude for: {address}, {city}, {country}?
    Return ONLY a JSON object like {{"lat": 51.5074, "lng": -0.1278}} with no other text."""
    
    try:
        response = client.chat.completions.create(
            model="llama3-8b-8192",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=100
        )
        
        content = response.choices[0].message.content.strip()
        if "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
            
        coords = json.loads(content)
        return coords.get("lat", 0.0), coords.get("lng", 0.0)
    except:
        return 0.0, 0.0
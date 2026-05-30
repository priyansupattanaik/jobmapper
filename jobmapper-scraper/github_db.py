import requests
import json
import base64
from datetime import datetime
from config import GITHUB_TOKEN, REPO_OWNER, REPO_NAME, BRANCH

class GitHubDB:
    def __init__(self):
        self.base_url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}"
        self.headers = {
            "Authorization": f"token {GITHUB_TOKEN}",
            "Accept": "application/vnd.github.v3+json"
        }
    
    def _encode_content(self, content: str) -> str:
        return base64.b64encode(content.encode()).decode()
    
    def job_exists(self, job_id: str) -> bool:
        """Check if job already exists to prevent duplicates"""
        path = f"data/jobs/{job_id}.json"
        url = f"{self.base_url}/contents/{path}?ref={BRANCH}"
        
        response = requests.get(url, headers=self.headers)
        return response.status_code == 200
    
    def save_job(self, job_data: dict) -> bool:
        """Save individual job as JSON file"""
        job_id = job_data["id"]
        if self.job_exists(job_id):
            print(f"Job {job_id} already exists, skipping...")
            return False
        
        path = f"data/jobs/{job_data['id']}.json"
        url = f"{self.base_url}/contents/{path}"
        
        content = json.dumps(job_data, indent=2)
        encoded = self._encode_content(content)
        
        data = {
            "message": f"Add job: {job_data.get('title', 'Unknown')} at {job_data.get('company', 'Unknown')}",
            "content": encoded,
            "branch": BRANCH
        }
        
        response = requests.put(url, headers=self.headers, json=data)
        
        if response.status_code == 201:
            print(f"Successfully saved job: {job_data.get('title')}")
            self._update_index(job_data)
            return True
        else:
            print(f"Failed to save job: {response.text}")
            return False
    
    def _update_index(self, new_job: dict):
        """Update the main jobs index file"""
        path = "data/jobs/index.json"
        url = f"{self.base_url}/contents/{path}?ref={BRANCH}"
        
        # Get existing index
        current = requests.get(url, headers=self.headers)
        if current.status_code == 200:
            content = base64.b64decode(current.json()["content"]).decode()
            index_data = json.loads(content)
            sha = current.json()["sha"]
        else:
            index_data = {"jobs": [], "lastUpdated": ""}
            sha = None
        
        # Add new job reference
        index_data["jobs"].append({
            "id": new_job["id"],
            "title": new_job["title"],
            "company": new_job["company"],
            "city": new_job["location"]["city"],
            "addedAt": datetime.now().isoformat()
        })
        index_data["lastUpdated"] = datetime.now().isoformat()
        
        # Save back
        update_url = f"{self.base_url}/contents/{path}"
        update_data = {
            "message": f"Update job index with {new_job['id']}",
            "content": self._encode_content(json.dumps(index_data, indent=2)),
            "branch": BRANCH,
            "sha": sha
        }
        
        requests.put(update_url, headers=self.headers, json=update_data)
    
    def batch_update(self, jobs: list):
        """Fallback method if API rate limit is hit - creates a single file with all jobs"""
        path = "data/jobs/batch_upload.json"
        url = f"{self.base_url}/contents/{path}"
        
        # Check if file exists
        existing = requests.get(f"{url}?ref={BRANCH}", headers=self.headers)
        sha = existing.json().get("sha") if existing.status_code == 200 else None
        
        content = json.dumps({"jobs": jobs, "uploadedAt": datetime.now().isoformat()}, indent=2)
        data = {
            "message": f"Batch upload of {len(jobs)} jobs",
            "content": self._encode_content(content),
            "branch": BRANCH
        }
        if sha:
            data["sha"] = sha
            
        response = requests.put(url, headers=self.headers, json=data)
        return response.status_code == 201
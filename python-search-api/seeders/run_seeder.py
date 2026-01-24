import json
import uuid
import sys
import os

# Add the parent directory to the path so we can import SearchService
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from search_service import SearchService

def seed_database():
    # Initialize our existing service
    search_svc = SearchService()
    
    # Path to our data
    data_path = os.path.join(os.path.dirname(__file__), 'posts_data.json')
    
    try:
        with open(data_path, 'r') as f:
            posts = json.load(f)
            
        print(f"--- Starting seeding for {len(posts)} posts ---")
        
        for post in posts:
            # Generate a real random UUID for each seed post
            post_uuid = str(uuid.uuid4())
            title = post['title']
            description = post['description']
            
            print(f"Seeding: {title}...")
            
            # Use our existing service logic
            search_svc.store_post(post_uuid, title, description)
            
        print("--- Seeding completed successfully ---")
        
    except FileNotFoundError:
        print(f"Error: Could not find {data_path}")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    seed_database()
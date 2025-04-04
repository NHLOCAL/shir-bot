import os
import certifi
import time

# This should be set automatically by the runner environment
# os.environ['SSL_CERT_FILE'] = certifi.where() 
# If you encounter SSL issues in GitHub Actions, you might need certifi explicitly
# but often the runners handle this. Try without it first.


from google_auth_oauthlib.flow import InstalledAppFlow # Keep import for Credentials loading
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
# from googleapiclient.http import MediaFileUpload # Not needed for shortcuts

# --- הגדרות ---
# Using drive scope ensures read/write capabilities needed
SCOPES = ['https://www.googleapis.com/auth/drive'] 
# File names expected by the GitHub Actions workflow step
CLIENT_SECRET_FILE = 'client_secret_auth.json'
TOKEN_FILE = 'token.json'

# --- IDs remain the same ---
SOURCE_ROOT_FOLDER_ID = "1sMGZLisLMAZKKeCVnkGREZbUW7aXst08"  # ID תיקיית המקור הראשית
TARGET_ROOT_FOLDER_ID = "1dfyehiuGrgj2B_76-9I-nJqJ3VOLP3v_"  # ID תיקיית היעד לקיצורי הדרך
SINGLES_FOLDER_NAME = "סינגלים"  # השם המדויק של תיקיית הסינגלים

# Remove or comment out the limit for automated runs
# MAX_FILES_TO_PROCESS = 20 
# --- סוף הגדרות ---

def authenticate():
    """
    Authenticates using existing token.json provided via GitHub Secrets.
    Refreshes the token if necessary. Does NOT perform interactive auth.
    """
    creds = None
    if not os.path.exists(TOKEN_FILE):
        print(f"Error: {TOKEN_FILE} not found. Ensure it's created from secrets.")
        return None # Cannot proceed without token in non-interactive env
        
    try:
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    except ValueError as e:
        print(f"Error loading credentials from {TOKEN_FILE}: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error loading credentials: {e}")
        return None

    # If credentials are not valid (e.g., malformed file), stop.
    if not creds:
         print(f"Could not load credentials from {TOKEN_FILE}.")
         return None

    # If credentials need refreshing, attempt to refresh
    # This requires the token.json to contain a valid refresh_token
    if not creds.valid:
        if creds.expired and creds.refresh_token:
            print("Credentials expired. Attempting to refresh token...")
            try:
                creds.refresh(Request())
                print("Token refreshed successfully.")
                # In a long-running non-interactive process, you might want to 
                # re-save the token here, but in GitHub Actions it's ephemeral.
                # If you needed persistence, you'd need a different storage mechanism.
            except Exception as e:
                # This is critical in Actions - if refresh fails, it cannot proceed
                print(f"Error refreshing token: {e}")
                print("Refresh token might be invalid or revoked.")
                print("Generate a new token.json locally and update the GOOGLE_TOKEN_JSON secret.")
                return None # Cannot continue
        else:
            # Credentials invalid for other reasons or no refresh token
            print("Credentials are not valid and cannot be refreshed.")
            if not creds.refresh_token:
                 print("Reason: Missing refresh token in token.json.")
            return None # Cannot continue

    return creds

# --- Helper functions (list_items, create_folder, create_shortcut) remain the same ---
# (Make sure they are included in your actual file)

def list_items(service, query, fields="nextPageToken, files(id, name, mimeType)"):
    """Helper function to list files/folders with pagination."""
    items = []
    page_token = None
    while True:
        try:
            response = service.files().list(
                q=query,
                spaces='drive',
                fields=fields,
                pageToken=page_token,
                 # Add Shared Drive support if needed (uncomment):
                 # supportsAllDrives=True,
                 # includeItemsFromAllDrives=True,
                 # corpora='allDrives',
            ).execute()
            
            items.extend(response.get('files', []))
            page_token = response.get('nextPageToken', None)
            if page_token is None:
                break
            time.sleep(0.1) # Small delay between pages potentially
        except HttpError as error:
            print(f"An error occurred during list_items: {error}")
            break 
    return items

def create_folder(service, name, parent_id):
    """Creates a folder and returns its ID."""
    try:
        folder_metadata = {
            'name': name,
            'mimeType': 'application/vnd.google-apps.folder',
            'parents': [parent_id]
        }
        folder = service.files().create(body=folder_metadata, fields='id').execute()
        print(f"Created folder '{name}' with ID: {folder.get('id')}")
        return folder.get('id')
    except HttpError as error:
        print(f"An error occurred creating folder '{name}': {error}")
        return None

def create_shortcut(service, target_id, shortcut_name, parent_id):
    """Creates a shortcut."""
    try:
        shortcut_metadata = {
            'name': shortcut_name,
            'mimeType': 'application/vnd.google-apps.shortcut',
            'shortcutDetails': {
                'targetId': target_id
            },
            'parents': [parent_id]
        }
        shortcut = service.files().create(body=shortcut_metadata, fields='id').execute()
        print(f"  Created shortcut '{shortcut_name}' -> {target_id} (ID: {shortcut.get('id')})")
        return shortcut.get('id')
    except HttpError as error:
        print(f"An error occurred creating shortcut for target '{target_id}': {error}")
        # You might want to return None or raise the exception in Actions
        return None

def process_drive_structure():
    """Main function to process the Drive structure and create shortcuts."""
    creds = authenticate()
    if not creds:
        print("Authentication failed or credentials invalid. Exiting.")
        # Exit with a non-zero status code to fail the GitHub Action step
        exit(1) 
        
    try:
        service = build('drive', 'v3', credentials=creds)
        print("Successfully authenticated and built Drive service.")
        
        processed_files_count = 0 # Keep counter for logging if desired
        # limit_reached = False # Limit removed

        print(f"Looking for artist folders in source root: {SOURCE_ROOT_FOLDER_ID}")
        artist_query = f"'{SOURCE_ROOT_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        artist_folders = list_items(service, artist_query)
        
        if not artist_folders:
            print("No artist folders found in the source directory.")
            return # Exit gracefully if no work to do

        print(f"Found {len(artist_folders)} potential artist folders.")

        for artist_folder in artist_folders:
            # if limit_reached: break # Limit removed
            
            artist_name = artist_folder.get('name')
            artist_id = artist_folder.get('id')
            print(f"\nProcessing Artist: {artist_name} (ID: {artist_id})")

            singles_folder_id = None
            singles_query = f"'{artist_id}' in parents and name = '{SINGLES_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
            items_in_artist_folder = list_items(service, singles_query, fields="files(id)") 
            
            if items_in_artist_folder:
                 singles_folder_id = items_in_artist_folder[0].get('id')
                 print(f"  Found '{SINGLES_FOLDER_NAME}' folder (ID: {singles_folder_id})")
            else:
                print(f"  No folder named '{SINGLES_FOLDER_NAME}' found for this artist. Skipping.")
                continue 

            target_folder_name = f"{artist_name} - {SINGLES_FOLDER_NAME}"
            # Add logic here if you want to FIND existing target folders instead of always creating
            # For now, it creates a new one matching the source structure concept
            target_singles_folder_id = create_folder(service, target_folder_name, TARGET_ROOT_FOLDER_ID)
            
            if not target_singles_folder_id:
                print(f"  Failed to create target folder '{target_folder_name}'. Skipping songs for this artist.")
                continue 

            songs_query = f"'{singles_folder_id}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false"
            songs = list_items(service, songs_query, fields="nextPageToken, files(id, name)")

            if not songs:
                 print(f"  No songs found in the source '{SINGLES_FOLDER_NAME}' folder.")
                 continue

            print(f"  Found {len(songs)} songs in source '{SINGLES_FOLDER_NAME}' folder. Creating shortcuts...")

            for song in songs:
                # if processed_files_count >= MAX_FILES_TO_PROCESS: # Limit removed
                #     print(f"\nReached the limit. Stopping.")
                #     limit_reached = True
                #     break 

                song_id = song.get('id')
                song_name = song.get('name')
                
                if create_shortcut(service, song_id, song_name, target_singles_folder_id):
                    processed_files_count += 1
                
                time.sleep(0.2) # Keep delay to avoid rate limits

        print(f"\nFinished processing. Total shortcuts created in this run: {processed_files_count}")

    except HttpError as error:
        print(f'An API error occurred: {error}')
        exit(1) # Fail the Action on API errors
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        exit(1) # Fail the Action on other errors

if __name__ == '__main__':
    process_drive_structure()
    print("\nScript finished successfully.")
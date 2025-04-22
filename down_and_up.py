# --- START OF FILE down_and_up.py ---

import requests
import time
from pathlib import Path
import sys # Import sys for checking execution environment
from bs4 import BeautifulSoup
import re
import json
import os
import csv
import datetime
from pyluach import dates, hebrewcal
import certifi
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
import logging

# --- Configuration & Constants ---
# Use relative paths, assuming script runs from repo root in Actions
# Local execution might require adjusting CWD or these paths.
SCRIPT_DIR = Path(__file__).parent.resolve() # Get script's directory
GDRIVE_SETUP_DIR = SCRIPT_DIR # Directory for local setup files (client_secret, initial token)
PROG_DOWN_DIR = SCRIPT_DIR / "down_from_prog" # If needed for temp downloads
STATE_FILE = SCRIPT_DIR / "state.json"
CSV_FILE = SCRIPT_DIR / "songs.csv"
TOKEN_FILE = SCRIPT_DIR / "token.json" # For local execution fallback/initial gen
CLIENT_SECRET_FILE = GDRIVE_SETUP_DIR / 'client_secret_auth.json' # Only for local initial auth

THREAD_URL = "https://www.prog.co.il/threads/387726"
SCOPES = ['https://www.googleapis.com/auth/drive.file']
BASE_FOLDER_ID = "1Rh2QafUuSjb4inShuqXwpHmh_V5HlJac"  # Replace with your base folder ID

# Ensure temp download dir exists if used (current script downloads to CWD)
# PROG_DOWN_DIR.mkdir(exist_ok=True)

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Set SSL cert file (important for requests/google libs)
os.environ['SSL_CERT_FILE'] = certifi.where()

# --- Helper Functions ---

def load_state():
    if STATE_FILE.exists():
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                state = json.load(f)
            # Ensure default values if keys are missing
            state.setdefault("page", 1248)
            state.setdefault("post_index", -1)
            state.setdefault("next_serial", 70000)
            return state
        except json.JSONDecodeError:
            logging.error(f"Error decoding JSON from {STATE_FILE}. Starting fresh.")
            return {"page": 1248, "post_index": -1, "next_serial": 70000}
    else:
        logging.info(f"{STATE_FILE} not found. Starting fresh.")
        return {"page": 1248, "post_index": -1, "next_serial": 70000}

def save_state(state):
    try:
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=4)
        logging.info(f"State saved to {STATE_FILE}")
    except Exception as e:
        logging.error(f"Failed to save state to {STATE_FILE}: {e}")


def write_csv_header_if_needed():
    if not CSV_FILE.exists() or os.path.getsize(CSV_FILE) == 0:
        try:
            with open(CSV_FILE, "w", newline="", encoding="utf-8") as csvfile:
                writer = csv.writer(csvfile)
                writer.writerow(["Serial Number", "Song Name", "Album Name", "Singer", "Drive ID"])
            logging.info(f"Created CSV header in {CSV_FILE}")
        except Exception as e:
            logging.error(f"Failed to write CSV header to {CSV_FILE}: {e}")


def append_song_to_csv(serial, song_name, album_name, singer, drive_id):
    try:
        with open(CSV_FILE, "a", newline="", encoding="utf-8") as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow([serial, song_name, album_name, singer, drive_id])
        # logging.info(f"Appended song {serial} to {CSV_FILE}") # Can be too verbose
    except Exception as e:
        logging.error(f"Failed to append song {serial} to {CSV_FILE}: {e}")


def download_mp3(media_url, desired_filename=None):
    # Sanitize filename (more robust)
    if desired_filename:
        # Remove invalid chars for common filesystems, replace with underscore
        safe_name = re.sub(r'[<>:"/\\|?*]', '_', desired_filename)
        # Remove leading/trailing whitespace/dots
        safe_name = safe_name.strip('. ')
        # Ensure it ends with .mp3
        if not safe_name.lower().endswith(".mp3"):
            safe_name += ".mp3"
        local_filename = safe_name
    else:
        # Basic fallback if no desired name
        try:
            url_path = Path(requests.utils.urlparse(media_url).path)
            local_filename = url_path.name if url_path.name else "downloaded_song.mp3"
            if not local_filename.lower().endswith(".mp3"):
                local_filename += ".mp3"
        except Exception:
            local_filename = "downloaded_song.mp3" # Absolute fallback

    # Use a temporary path within the script directory for download
    temp_download_path = SCRIPT_DIR / local_filename
    logging.info(f"Downloading: {media_url} to {temp_download_path}")

    headers = {'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'}

    try:
        with requests.get(media_url, headers=headers, stream=True, timeout=60) as r: # Added timeout
            r.raise_for_status()
            with open(temp_download_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
        logging.info(f"Download complete: {temp_download_path}")
        return temp_download_path # Return the Path object
    except requests.exceptions.RequestException as e:
        logging.error(f"Error downloading {media_url}: {e}")
        # Clean up partial download if it exists
        if temp_download_path.exists():
            try:
                os.remove(temp_download_path)
            except OSError as oe:
                logging.warning(f"Could not remove partial download {temp_download_path}: {oe}")
        return None


def extract_page_num(url):
    match = re.search(r"page-(\d+)", url)
    if match:
        return int(match.group(1))
    # Fallback for URLs without page-N, assuming page 1
    if "/threads/" in url and "page-" not in url:
        return 1
    logging.warning(f"Could not extract page number from URL: {url}")
    return None

def convert_to_hebrew_month_year(greg_date_str):
    try:
        # Handle potential timezone formats (+HHMM or Z)
        if greg_date_str.endswith('Z'):
            greg_date_str = greg_date_str[:-1] + '+00:00'
        dt = datetime.datetime.fromisoformat(greg_date_str)
        # Convert to UTC date to be safe
        g_date = dt.astimezone(datetime.timezone.utc).date()
        heb_date = dates.GregorianDate(g_date.year, g_date.month, g_date.day).to_heb()
        # Use pyluach's built-in string formatting
        return f"{hebrewcal.Month(heb_date.year, heb_date.month).hebrew_month_name()} {heb_date.hebrew_year_str()}"
    except Exception as e:
        logging.error(f"Error converting date '{greg_date_str}': {e}")
        return "תאריך לא זמין"


def authenticate():
    """Authenticates the user using GitHub Secrets first, then local files."""
    creds = None
    token_json_content = os.environ.get('GDRIVE_TOKEN_JSON_CONTENT')

    # --- GitHub Actions Authentication (using environment variable) ---
    if token_json_content:
        logging.info("Attempting authentication using environment variable (GitHub Secret).")
        try:
            # The secret should contain the JSON content directly
            token_info = json.loads(token_json_content)
            creds = Credentials.from_authorized_user_info(token_info, SCOPES)
            # Check if token needs refresh (optional but good practice)
            if creds.expired and creds.refresh_token:
                 logging.info("Refreshing credentials from environment variable.")
                 try:
                     creds.refresh(Request())
                     # Note: In Actions, we can't easily *update* the secret with the refreshed token.
                     # The refreshed token is only valid for this run.
                     # Frequent runs or a long-expiry initial token are needed.
                 except Exception as e:
                     logging.error(f"Failed to refresh credentials from environment variable: {e}")
                     # Fallback to potentially trying local file if exists? Or just fail?
                     creds = None # Force fallback or failure if refresh fails
            if creds and creds.valid:
                 logging.info("Successfully authenticated using environment variable.")
                 return creds
            else:
                logging.warning("Credentials from environment variable are invalid or expired and could not be refreshed.")
                creds = None # Ensure fallback is triggered if invalid

        except json.JSONDecodeError as e:
            logging.error(f"Could not decode JSON from GDRIVE_TOKEN_JSON_CONTENT environment variable: {e}")
            creds = None # Force fallback
        except Exception as e:
            logging.error(f"Error authenticating via environment variable: {e}")
            creds = None # Force fallback


    # --- Local Authentication (using token.json file) ---
    # This part runs if the environment variable wasn't found or didn't yield valid creds
    logging.info("Attempting authentication using local token.json file.")
    if TOKEN_FILE.exists():
        try:
            creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
        except Exception as e:
            logging.error(f"Error loading credentials from {TOKEN_FILE}: {e}")
            creds = None

    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            logging.info(f"Refreshing credentials from local {TOKEN_FILE}.")
            try:
                creds.refresh(Request())
            except Exception as e:
                 logging.error(f"Failed to refresh token from {TOKEN_FILE}: {e}. Manual re-authentication might be needed.")
                 creds = None # Force re-auth if refresh fails

        # Only run the flow if we STILL don't have creds AND client_secret exists
        if not creds or not creds.valid:
            if CLIENT_SECRET_FILE.exists():
                 logging.info(f"No valid credentials found. Starting authentication flow using {CLIENT_SECRET_FILE}.")
                 # Check if running in a non-interactive environment (like GitHub Actions without the secret)
                 if 'GITHUB_ACTIONS' in os.environ and not token_json_content:
                      logging.error("Cannot run interactive auth flow in GitHub Actions. Ensure GDRIVE_TOKEN_JSON_CONTENT secret is set.")
                      return None # Exit authentication if in Actions without secret
                 try:
                    flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT_SECRET_FILE), SCOPES)
                    # Ensure user knows where to find the URL if run headless
                    # Consider adding instructions if 'DISPLAY' env var not set?
                    creds = flow.run_local_server(port=0)
                 except Exception as e:
                     logging.error(f"Authentication flow failed: {e}")
                     return None
                 # Save the credentials for the next run (locally)
                 try:
                     with open(TOKEN_FILE, 'w') as token:
                         token.write(creds.to_json())
                     logging.info(f"Credentials saved to {TOKEN_FILE}")
                 except Exception as e:
                     logging.error(f"Failed to save credentials to {TOKEN_FILE}: {e}")
            else:
                 logging.error(f"Cannot authenticate: {CLIENT_SECRET_FILE} not found and no valid {TOKEN_FILE} or environment variable.")
                 return None

    if creds and creds.valid:
        logging.info("Authentication successful.")
        return creds
    else:
        logging.error("Authentication failed.")
        return None


def get_or_create_folder(service, folder_name, parent_folder_id):
    """Checks if a folder exists and returns its ID. Creates it if it doesn't exist."""
    # Sanitize folder name for Drive API query (escape single quotes)
    sanitized_name = folder_name.replace("'", "\\'")
    query = f"name='{sanitized_name}' and '{parent_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
    try:
        response = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
        files = response.get('files', [])

        if files:
            folder_id = files[0]['id']
            logging.info(f"Found existing folder: '{folder_name}' with ID: {folder_id}")
            return folder_id
        else:
            logging.info(f"Folder '{folder_name}' not found. Creating it under parent {parent_folder_id}.")
            file_metadata = {
                'name': folder_name, # Use original name for creation
                'mimeType': 'application/vnd.google-apps.folder',
                'parents': [parent_folder_id]
            }
            folder = service.files().create(body=file_metadata, fields='id').execute()
            folder_id = folder.get('id')
            logging.info(f"Created folder: '{folder_name}' with ID: {folder_id}")
            return folder_id
    except Exception as e:
        logging.error(f"Error finding or creating folder '{folder_name}': {e}")
        raise # Re-raise the exception to potentially stop the process


def upload_file_to_drive(service, file_path: Path, file_name_on_drive: str, mime_type: str, folder_id: str, retries=3, delay=5):
    """Uploads a file to Google Drive with retries."""
    if not file_path.exists():
        logging.error(f"Cannot upload: File not found at {file_path}")
        return None

    # Use the sanitized filename provided to download_mp3 if available, else use path's name
    upload_name = file_name_on_drive if file_name_on_drive else file_path.name

    logging.info(f"Uploading '{file_path.name}' as '{upload_name}' to folder ID {folder_id}")
    file_metadata = {'name': upload_name, 'parents': [folder_id]}
    media = MediaFileUpload(str(file_path), mimetype=mime_type, resumable=True) # Use resumable

    for attempt in range(retries):
        try:
            request = service.files().create(body=file_metadata, media_body=media, fields='id')
            response = None
            upload_start_time = time.time()
            while response is None:
                status, response = request.next_chunk()
                if status:
                    logging.info(f"Upload progress: {int(status.progress() * 100)}%")
            upload_duration = time.time() - upload_start_time
            file_id = response.get('id')
            logging.info(f"Successfully uploaded '{upload_name}' (ID: {file_id}) in {upload_duration:.2f} seconds.")
            return file_id
        # Specific exception for timeouts if identifiable, otherwise broader catch
        except TimeoutError as e: # Python's built-in TimeoutError might not be raised by google lib directly
             logging.warning(f"Upload attempt {attempt + 1}/{retries} timed out: {e}")
        except Exception as e: # Catch other googleapiclient errors etc.
            logging.warning(f"Upload attempt {attempt + 1}/{retries} failed: {e}")

        if attempt < retries - 1:
            logging.info(f"Retrying in {delay} seconds...")
            time.sleep(delay)
        else:
            logging.error(f"Upload failed for '{upload_name}' after {retries} retries.")
            return None # Indicate failure

# --- Main Processing Function ---

def process_page(page_url, start_index, state, service):
    logging.info(f"Processing page: {page_url}, starting from post index: {start_index}")
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'} # Consistent UA
    try:
        r = requests.get(page_url, headers=headers, timeout=30)
        r.raise_for_status() # Check for HTTP errors
    except requests.exceptions.RequestException as e:
        logging.error(f"Failed to fetch page {page_url}: {e}")
        # Indicate page fetch failure; don't advance page number but maybe allow retry later?
        # Returning False for has_posts effectively stops the current run for this path.
        return start_index -1, False # Return previous index, signal no posts processed on this attempt

    # Handle potential redirects and compare page numbers
    requested_page_num = extract_page_num(page_url)
    actual_page_num = extract_page_num(r.url)

    # Allow processing if redirected to page 1 when requesting page 1
    is_redirect_ok = (requested_page_num == 1 and actual_page_num == 1)

    if requested_page_num is None:
         logging.error("Could not extract requested page number. Aborting page processing.")
         return start_index -1, False

    if actual_page_num is None:
        logging.warning(f"Could not extract actual page number from redirected URL: {r.url}. Proceeding cautiously.")
        # We might be on an unexpected page. Decide if to proceed or stop.
        # For now, let's proceed but log the warning.

    # If redirected to a *different* page than requested (and it's not the special case of page 1)
    # This often means we requested a page beyond the last page.
    if requested_page_num != actual_page_num and not is_redirect_ok :
        logging.info(f"Redirected from {page_url} to {r.url}. Assuming end of thread or issue.")
        return start_index - 1, False # Signal end/issue

    try:
        soup = BeautifulSoup(r.text, 'html.parser')
        # Look for the specific structure of posts containing messages
        posts = soup.select("article.message--post") # More specific selector if possible
        if not posts:
            # Fallback selectors if the primary one fails
            posts = soup.find_all("article", class_="message")
        if not posts:
            posts = soup.find_all("div", class_="message-inner") # Broader fallback

    except Exception as e:
        logging.error(f"Error parsing HTML for page {page_url}: {e}")
        return start_index - 1, False

    if not posts:
        # It's possible a valid page has no posts (e.g., moderation cleared them)
        # Or maybe the selectors are wrong for this specific page layout variation
        logging.warning(f"No posts found on page {page_url} using known selectors.")
        # Let's assume this means no *new* processable content on this page
        # We should advance to the next page, so report the last possible index
        return -1, True # Signal "processed" page (even if empty), reset index for next page


    new_last_processed_index = start_index - 1 # Keep track of the last *successfully processed* post index on this page
    found_new_song_on_page = False

    for i, post in enumerate(posts):
        # Skip posts already processed in a previous run (if resuming on same page)
        if i < start_index:
            continue

        logging.debug(f"Processing post index {i} on page {actual_page_num or requested_page_num}")

        # Find MP3 link specifically within an attachment block if possible
        attachment_div = post.find("div", class_="js-attachmentFile") # Prog specific?
        mp3_anchor = None
        if attachment_div:
             mp3_anchor = attachment_div.find("a", href=re.compile(r"\.mp3(\?.*)?$", re.IGNORECASE)) # Allow query strings

        # Fallback to searching anywhere in the post if not in attachment block
        if not mp3_anchor:
            mp3_anchor = post.find("a", href=re.compile(r"\.mp3(\?.*)?$", re.IGNORECASE))

        if mp3_anchor:
            found_new_song_on_page = True
            # Resolve relative URLs
            try:
                mp3_link = requests.compat.urljoin(r.url, mp3_anchor["href"])
            except Exception as e:
                logging.error(f"Error resolving MP3 link {mp3_anchor.get('href', 'N/A')} on page {page_url}, post {i}: {e}")
                continue # Skip this post

            # Extract desired filename (improve robustness)
            descriptive_filename = None
            # Try multiple common patterns for filenames in Prog attachments
            file_name_span = post.find("span", class_="file-name")
            if file_name_span:
                descriptive_filename = file_name_span.get("title", file_name_span.get_text(strip=True))
            # Fallback to link text if no specific span
            if not descriptive_filename and mp3_anchor.get_text(strip=True):
                 descriptive_filename = mp3_anchor.get_text(strip=True)
            # Further fallback using the URL itself
            if not descriptive_filename:
                 try:
                     url_path = Path(requests.utils.urlparse(mp3_link).path)
                     if url_path.name and url_path.name.lower().endswith(".mp3"):
                         descriptive_filename = url_path.name
                 except Exception:
                     pass # Ignore errors here, will default later

            if not descriptive_filename:
                logging.warning(f"Could not determine descriptive filename for MP3 link {mp3_link} in post {i}. Using default.")
                descriptive_filename = "unknown_song.mp3" # Default filename

            logging.info(f"Found MP3: '{descriptive_filename}' in post {i} (Link: {mp3_link})")

            # --- Download ---
            local_file_path_obj = download_mp3(mp3_link, desired_filename=descriptive_filename)

            if local_file_path_obj:
                # --- Extract Metadata ---
                song_serial = state.get("next_serial", 70000)

                # Try to get a cleaner song name (remove extension, maybe common prefixes/suffixes)
                song_name = local_file_path_obj.stem # Use pathlib's stem
                # Basic cleanup (replace underscores, excessive spaces)
                song_name = re.sub(r'_+', ' ', song_name).strip()

                # Find the timestamp for the post
                time_tag = post.find("time", attrs={"datetime": True})
                album_name = "תאריך לא זמין" # Default
                if time_tag and time_tag.get("datetime"):
                    raw_date = time_tag["datetime"].strip()
                    album_name = convert_to_hebrew_month_year(raw_date)
                else:
                    logging.warning(f"Could not find datetime tag for post {i}")

                singer = "סינגלים חדשים" # Default or potentially extractable?

                # --- Google Drive ---
                try:
                    # Get/Create Monthly Folder
                    folder_id = get_or_create_folder(service, album_name, BASE_FOLDER_ID)

                    # Upload File
                    drive_id = upload_file_to_drive(service, local_file_path_obj, local_file_path_obj.name, 'audio/mpeg', folder_id)

                    if drive_id:
                        # --- Record Success ---
                        append_song_to_csv(song_serial, song_name, album_name, singer, drive_id)
                        state["next_serial"] = song_serial + 1 # Increment serial only on successful upload and CSV write
                        new_last_processed_index = i # Update the last successfully processed index *for this page*
                        logging.info(f"Successfully processed and uploaded song Serial {song_serial} (Drive ID: {drive_id})")
                    else:
                        logging.error(f"Failed to upload '{local_file_path_obj.name}' to Drive. Skipping CSV/state update for this song.")
                        # Decide: stop the whole process, or just skip this song? Let's skip.

                except Exception as e:
                    # Catch errors during Drive operations (folder or upload)
                    logging.error(f"Error during Google Drive operations for song '{song_name}': {e}")
                    # Decide: stop or skip? Let's skip this song.

                # --- Clean up downloaded file ---
                try:
                    # Add a small delay before deletion, might help on some systems/runners
                    time.sleep(0.5)
                    os.remove(local_file_path_obj)
                    logging.debug(f"Removed local file: {local_file_path_obj}")
                except PermissionError as e:
                    logging.warning(f"Could not delete {local_file_path_obj} (PermissionError): {e}")
                except FileNotFoundError:
                     logging.warning(f"Could not delete {local_file_path_obj} (Not Found - already deleted?)")
                except Exception as e:
                    logging.error(f"Unexpected error removing file {local_file_path_obj}: {e}")
            else:
                # Download failed, already logged in download_mp3
                logging.warning(f"Skipping processing for post {i} due to download failure.")
                # Do not update new_last_processed_index here, as processing wasn't complete
        else:
            # No MP3 link found in this post, just continue to the next
            pass

    # After looping through all posts on the page:
    # Return the index of the last successfully processed post.
    # If new songs were found OR if we started processing mid-page, return True for has_posts/page_valid.
    # If no new songs were found AND we started at index 0, it might be an empty page (return True).
    # If the page fetch failed or redirected badly, earlier returns handled it.
    return new_last_processed_index, True


def main():
    logging.info("--- Script Start ---")
    state = load_state()
    saved_page = state.get("page", 1248)
    saved_post_index = state.get("post_index", -1)

    logging.info(f"Loaded state: Start Page={saved_page}, Last Processed Post Index={saved_post_index}, Next Serial={state.get('next_serial')}")

    write_csv_header_if_needed()

    # Authenticate
    creds = authenticate()
    if not creds:
        logging.error("Authentication failed. Exiting.")
        sys.exit(1) # Exit with error code

    try:
        service = build('drive', 'v3', credentials=creds)
        logging.info("Google Drive service client created.")
    except Exception as e:
        logging.error(f"Failed to build Google Drive service: {e}")
        sys.exit(1)


    page = saved_page
    max_consecutive_empty_pages = 5 # Stop if we find too many consecutive pages without new songs/valid posts
    consecutive_empty_counter = 0
    max_pages_to_process = 100 # Safety break to prevent infinite loops in dev/testing
    pages_processed_count = 0

    while pages_processed_count < max_pages_to_process :
        page_url = f"{THREAD_URL.rstrip('/')}/page-{page}"

        # Determine the starting post index for this page
        # If it's the page we loaded state for, resume from the next post
        # Otherwise (new page), start from the beginning (index 0)
        start_index_on_page = saved_post_index + 1 if page == saved_page else 0

        new_last_post_index, page_processed_successfully = process_page(page_url, start_index_on_page, state, service)

        pages_processed_count += 1

        if page_processed_successfully:
            # If processing was successful (even if no new songs were found), update state
            state["page"] = page
            state["post_index"] = new_last_post_index
            save_state(state) # Save state after each successfully processed page

            # Check if any new work was actually done on this page
            # new_last_post_index increases only if a song was processed successfully
            if new_last_post_index >= start_index_on_page :
                 consecutive_empty_counter = 0 # Reset counter if work was done
            else:
                 # No new songs processed on this page (or page was empty/only had skipped items)
                 consecutive_empty_counter += 1
                 logging.info(f"No new songs processed on page {page}. Consecutive empty count: {consecutive_empty_counter}")

            # Advance to the next page
            page += 1
            saved_page = page # Ensure next iteration starts fresh page unless state tells otherwise
            saved_post_index = -1 # Reset post index for the next page

            # Check if we hit the consecutive empty page limit
            if consecutive_empty_counter >= max_consecutive_empty_pages:
                logging.info(f"Stopping scan after {max_consecutive_empty_pages} consecutive pages with no new songs found or processed.")
                break

        else:
            # process_page returned False, indicating a likely end-of-thread or critical error
            logging.warning(f"Stopping scan because page {page} processing failed or indicated end of thread.")
            # Do not increment page number, allow the script to retry from this page next time if desired
            # State is *not* saved here to reflect the failure on this page.
            break

        # Optional: add a small delay between processing pages
        time.sleep(1) # Be polite to the server

    if pages_processed_count >= max_pages_to_process:
         logging.warning(f"Stopped scan after reaching maximum page limit ({max_pages_to_process}).")

    logging.info("--- Script End ---")

if __name__ == "__main__":
    main()

# --- END OF FILE down_and_up.py ---
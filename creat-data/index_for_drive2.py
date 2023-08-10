import csv
import os
from googleapiclient.discovery import build
from google.oauth2 import service_account

# Set up Google Drive API credentials
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
SERVICE_ACCOUNT_FILE = os.getenv('ACCESS_KEYS_JSON')

def main(FOLDER_ID, singer_name):
    # Authenticate and create the Drive service
    credentials = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES
    )
    service = build('drive', 'v3', credentials=credentials)

    # Create a CSV file and write headers
    csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output.csv')
    is_new_file = not os.path.exists(csv_path)
    
    with open(csv_path, 'a', newline='') as csvfile:
        writer = csv.writer(csvfile)
        if is_new_file:
            writer.writerow(["Serial Number", "Filename", "Album", "Singer", "File ID"])

        # Initialize serial number counter
        serial_number = 1

        # Traverse folder and process files
        process_folder(service, writer, FOLDER_ID, serial_number, singer_name)

    print('CSV file created successfully.')

def process_folder(service, writer, folder_id, serial_number, singer_name, parent_folder_id=None):
    # Rest of your process_folder function

# Rest of your get_folder_name function

def run_now():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, 'list-singers.csv')
    
    with open(csv_path, 'r') as file:
        csv_reader = csv.reader(file)
        singer_list = [tuple(row) for row in csv_reader]
        
    for singer_name, FOLDER_ID in singer_list:
        try:
           main(FOLDER_ID, singer_name)
        except:
            try:
                main(FOLDER_ID, singer_name)
            except:
                print('There was an error processing:', singer_name)

if __name__ == '__main__':
    run_now()

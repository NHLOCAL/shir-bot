import csv
import os

serial_number = 1


def main(singer_name, relative_path):
    # Specify the root folder where your local files are stored
    root_folder = r'D:\שמע'
    
    global serial_number 

    # Create a CSV file and write headers
    with open('list-songs-with-paths.csv', 'a', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        
        main_folder = os.path.join(root_folder, relative_path)

        # Traverse the local folder and process files
        process_local_folder(writer, main_folder, singer_name)

    print('CSV file created successfully.')

def process_local_folder(writer, main_folder, singer_name):
    
    global serial_number 
    
    root_folder = r'D:\שמע'
    
    # Iterate through the files in the local folder
    for root, _, files in os.walk(main_folder):
        for filename in files:
            
            if not filename.lower().endswith((".mp3",".wma", ".wav")):
                continue
            
            filepath = os.path.join(root, filename)
            
            # Construct the relative path of the file
            relative_path = os.path.relpath(filepath, root_folder)
            
            albume_name = os.path.basename(os.path.dirname(filepath))
            
            writer.writerow([serial_number, os.path.splitext(filename)[0], albume_name, singer_name, relative_path])
            
            serial_number += 1

def run_now():
    csv_path = 'list-singers-with-paths.csv'

    with open(csv_path, 'r') as file:
        csv_reader = csv.reader(file)
        singer_list = [tuple(row) for row in csv_reader]


    for singer_name, relative_path in singer_list:
        try:
            main(singer_name, relative_path)
        except Exception as e:
            print(e)
            print('There was an error')

if __name__ == '__main__':
    run_now()

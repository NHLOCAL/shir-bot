import os
import csv

# List of singers to exclude
excluded_singers = ['עומר אדם', 'יהורם גאון', 'עדן חסון', 'נתן גושן']  # Add your excluded singers here

def create_csv_of_folders(folder, output_csv_path):
    # Create or overwrite the CSV file
    with open(output_csv_path, 'a', newline='') as csvfile:
        writer = csv.writer(csvfile)
        
        main_folder = r'D:\שמע'
        
        # Iterate through the main folder
        for folder_name in os.listdir(folder):
            if folder_name in excluded_singers:
                continue  # Skip if the folder name is in the excluded singers list
            
            folder_path = os.path.join(folder, folder_name)
            
            if os.path.isdir(folder_path):
                # Calculate the relative path
                relative_path = os.path.relpath(folder_path, main_folder)

                # Write folder name and relative path to the CSV file
                writer.writerow([folder_name, relative_path])

# Specify the path where you want to save the CSV file
output_csv_path = 'folder_list.csv'

def main():
    main_folders = ['D:\\שמע\\כל המוזיקה', 'D:\\שמע\\מסודר מחדש\\אוספים', 'D:\\שמע\\מסודר מחדש\\דואטים', 'D:\\שמע\\מסודר מחדש\\הופעות ואירועים', 'D:\\שמע\\מסודר מחדש\\זמרי שירים בודדים', 'D:\\שמע\\מסודר מחדש\\חזנות', 'D:\\שמע\\מסודר מחדש\\חסידויות', 'D:\\שמע\\מסודר מחדש\\ילדי פלא', 'D:\\שמע\\מסודר מחדש\\לא מוגדר', 'D:\\שמע\\מסודר מחדש\\מוזיקה אלטרנטיבית', 'D:\\שמע\\מסודר מחדש\\מוזיקה אמריקאית', 'D:\\שמע\\מסודר מחדש\\מוזיקה חסידית', 'D:\\שמע\\מסודר מחדש\\מוזיקה ישראלית', 'D:\\שמע\\מסודר מחדש\\מוזיקה מזרחית', 'D:\\שמע\\מסודר מחדש\\מנגינות ומחרוזות', 'D:\\שמע\\מסודר מחדש\\מקבצי זמרים', 'D:\\שמע\\מסודר מחדש\\מקהלות ותזמורות']
    
    for folder in main_folders:
        create_csv_of_folders(folder, output_csv_path)
           
main()

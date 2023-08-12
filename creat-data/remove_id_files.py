import csv

# Define the input filename
input_filename = 'output.csv'

# Define the output filenames for the two scenarios
output_renumber_filename = 'songs-for-sheets.csv'
output_renumber_and_remove_filename = 'songs.csv'

# Initialize a counter for renumbering
row_counter = 1

# Open the input CSV file for reading with the correct encoding
with open(input_filename, 'r', encoding='utf-8') as input_file, \
        open(output_renumber_filename, 'w', newline='', encoding='utf-8') as output_renumber_file, \
        open(output_renumber_and_remove_filename, 'w', newline='', encoding='utf-8') as output_renumber_remove_file:
    
    reader = csv.reader(input_file)
    writer_renumber = csv.writer(output_renumber_file)
    writer_renumber_remove = csv.writer(output_renumber_remove_file)
    
    # Iterate through each row in the input CSV
    for row in reader:
        # Renumber column A with consecutive digits
        row[0] = str(row_counter)
        row_counter += 1
        
        # Write the renumbered row to the output file without removing the fifth column
        writer_renumber.writerow(row)
        
        # Exclude the fifth column by slicing the row for renumbering and removal
        new_row_renumber_remove = row[:4]  # Assuming the index is zero-based
        
        # Write the modified row to the output file with renumbering and removal
        writer_renumber_remove.writerow(new_row_renumber_remove)

print("Two new CSV files have been created:")
print(f"- {output_renumber_filename}: Renumbered without removing the fifth column")
print(f"- {output_renumber_and_remove_filename}: Renumbered and fifth column removed")

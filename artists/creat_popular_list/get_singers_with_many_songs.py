import csv

def extract_singers(csv_file):
    singer_counts = {}
    with open(csv_file, 'r', newline='', encoding='utf-8') as file:  # Specify encoding
        reader = csv.reader(file)
        next(reader)  # Skip header row
        for row in reader:
            singer = row[3].strip()  # Assuming singer's name is in column D
            singer_counts[singer] = singer_counts.get(singer, 0) + 1
    return singer_counts


def write_singers_to_file(singer_counts, output_file):
    with open(output_file, 'w') as file:
        for singer, count in singer_counts.items():
            if count >= 4:
                file.write(f"{singer}\n")

def main():
    csv_file = r"C:\Users\משתמש\Documents\GitHub\shir-bot\site\new-songs.csv" # Path to your CSV file
    output_file = 'popular_singers.txt'  # Path to output text file
    singer_counts = extract_singers(csv_file)
    write_singers_to_file(singer_counts, output_file)
    print("List of popular singers has been created.")

if __name__ == "__main__":
    main()

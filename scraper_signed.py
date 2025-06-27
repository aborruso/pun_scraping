

import requests
import json
import time
import subprocess
from requests_aws4auth import AWS4Auth

def get_fresh_credentials():
    """Executes the Playwright script to fetch fresh AWS credentials."""
    print("Getting fresh AWS credentials...")
    try:
        subprocess.run(["node", "get_credentials.js"], check=True, capture_output=True, text=True)
        print("Credentials updated successfully.")
        with open('aws_creds.json', 'r') as f:
            return json.load(f)
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        print(f"Error getting credentials: {e}")
        if hasattr(e, 'stderr'):
            print(f"Node.js script error: {e.stderr}")
        return None

def main():
    """Main function to read IDs, fetch details in batches, and save them."""
    try:
        with open('pun_pdr.ndjson', 'r') as f:
            # Extract evse_id from each line in the ndjson file
            station_ids = [json.loads(line).get('evse_id') for line in f if line.strip()]
    except FileNotFoundError:
        print("Error: pun_pdr.ndjson not found.")
        return

    # The API endpoint for fetching station group details.
    url = "https://api.pun.piattaformaunicanazionale.it/v1/chargepoints/group"
    headers = {"Content-Type": "application/json; charset=UTF-8"}
    region = "eu-south-1"
    service = "execute-api"

    # Process IDs in chunks of 100
    chunk_size = 100
    for i in range(0, len(station_ids), chunk_size):
        chunk = station_ids[i:i + chunk_size]
        print(f"\nProcessing chunk {i//chunk_size + 1}: {chunk}")

        # Get fresh credentials for each batch
        creds = get_fresh_credentials()
        if not creds:
            print("Could not get credentials, skipping chunk.")
            continue

        auth = AWS4Auth(
            creds['accessKeyId'],
            creds['secretAccessKey'],
            region,
            service,
            session_token=creds['sessionToken']
        )

        try:
            response = requests.post(url, auth=auth, json=chunk, headers=headers)
            response.raise_for_status()
            data = response.json()

            if data:
                # Append results to the jsonl file
                with open("station_details.jsonl", mode='a', encoding='utf-8') as file:
                    for station in data:
                        file.write(json.dumps(station) + '\n')
                print(f"Successfully fetched and appended details for {len(data)} stations.")
            else:
                print("No data received for this chunk.")

        except requests.exceptions.RequestException as e:
            print(f"HTTP Request Error for chunk: {e}")
        except Exception as e:
            print(f"An unexpected error occurred: {e}")
        
        # Wait for a second before processing the next chunk
        time.sleep(1)

if __name__ == "__main__":
    main()

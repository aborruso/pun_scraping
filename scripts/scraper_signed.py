import requests
import json
import time
import subprocess
from requests_aws4auth import AWS4Auth
import sys
import os

def get_fresh_credentials():
    """Executes the Playwright script to fetch fresh AWS credentials."""
    print("Getting fresh AWS credentials...")
    os.makedirs('./tmp', exist_ok=True)
    try:
        subprocess.run(["node", "get_credentials.js"], check=True, capture_output=True, text=True)
        print("Credentials updated successfully.")
        with open('./tmp/aws_creds.json', 'r') as f:
            return json.load(f)
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        print(f"Error getting credentials: {e}")
        if hasattr(e, 'stderr'):
            print(f"Node.js script error: {e.stderr}")
        return None

def main():
    """Main function to read IDs, fetch details in batches, and save them."""
    debug_mode = '--debug' in sys.argv
    output_filename = "../data/debug_station_details.jsonl" if debug_mode else "../data/station_details.jsonl"

    if debug_mode:
        print("--- Running in DEBUG mode ---")
        if os.path.exists(output_filename):
            os.remove(output_filename)
            print(f"Removed old debug file: {output_filename}")

    try:
        with open('../data/pun_pdr.ndjson', 'r') as f:
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
    cycles = 0
    for i in range(0, len(station_ids), chunk_size):
        if debug_mode and cycles >= 3:
            print("\nDebug mode: Reached 3-cycle limit.")
            break
        cycles += 1

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
                with open(output_filename, mode='a', encoding='utf-8') as file:
                    for station in data:
                        file.write(json.dumps(station) + '\n')
                print(f"Successfully fetched and appended details for {len(data)} stations to {output_filename}.")
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

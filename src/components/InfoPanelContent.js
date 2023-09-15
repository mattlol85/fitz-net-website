import React, { useEffect, useState } from 'react';
import Constants from '../util/Constants'

function InfoPanelContent() {
  // Define state to store the fetched data and a loading state
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch data from the API
    console.log("Making API call");
    fetch(Constants.API_ADDRESS+":"+Constants.API_PORT+"/info")
      .then(response => {
        // If the response is successful, convert it to JSON
        if (response.ok) {
          return response.json();
        }
        // If not, throw an error
        throw new Error('Failed to fetch data');
      })
      .then(data => {
        // Save the fetched data to state
        setData(data);
        setLoading(false);
      })
      .catch(error => {
        // Handle any errors that occur during fetch
        console.error('Error fetching data:', error);
        setError("Fitz-Net API is down!");
        setLoading(false);
      });
  }, []); // Empty dependency array to ensure this effect runs only once

  return (
    <div>
      {/* <h1>Info Panel Content</h1> */}
      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p>Error: {error}</p>  // Display the error message
      ) : (
        <div>
          <pre>{JSON.stringify(data, null, 2)}</pre>
          <h2>API Status: {data.status === "alive"? "✅":"❌"}</h2>
          <h3>Collection Count: {data.collectionCount}</h3>
          <h3>Number of Requests: {data.numberOfRequests}</h3>
          <h3>Version: {data.version}</h3>
        </div>
      )}
    </div>
  );
}

export default InfoPanelContent;

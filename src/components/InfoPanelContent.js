import React, { useEffect, useState } from 'react';

function InfoPanelContent() {
  // Define state to store the fetched data and a loading state
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch data from the API
    fetch('https://fitznet.org/api/v1/api-info')
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
      <h1>Info Panel Content</h1>
      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p>Error: {error}</p>  // Display the error message
      ) : (
        <div>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default InfoPanelContent;

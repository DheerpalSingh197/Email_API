import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const emailsPerPage = 10;

function App() {
  const [emails, setEmails] = useState([]);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchEmails = async (page = 0) => {
    setLoading(true);
    const offset = page * emailsPerPage;
    try {
      const response = await axios.get('http://localhost:5001/api/emails', {
        params: {
          search,
          offset,
          limit: emailsPerPage,
        },
      });

      if (response.data && response.data.emails) {
        setEmails(response.data.emails);
        setPageCount(Math.ceil(response.data.total / emailsPerPage));
      } else {
        setEmails([]);
      }
    } catch (error) {
      console.error('Error fetching emails:', error);
      setEmails([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails(currentPage);
  }, [currentPage]);

  const handleSearch = () => {
    setCurrentPage(0);
    fetchEmails(0);
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    fetchEmails(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Scrolls to the top of the page
  };

  return (
    <div className="container">
      <h1>Email Search</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
      >
        <input
          type="text"
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit">Search</button>
      </form>

      {loading && <p>Loading...</p>}

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Subject</th>
            <th>Sender</th>
            <th>Body</th>
          </tr>
        </thead>
        <tbody>
          {emails.length > 0 ? (
            emails.map((email) => (
              <tr key={email.id}>
                <td>{email.id}</td>
                <td>{email.subject}</td>
                <td>{email.sender}</td>
                <td>{email.body}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="4">No emails found</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="pagination-info">
        <span>
          Page {currentPage + 1} of {pageCount}
        </span>
      </div>

      <ul className="pagination">
        {[...Array(pageCount)].map((_, i) => (
          <li key={i} className={i === currentPage ? 'active' : ''}>
            <a href="#!" onClick={() => handlePageChange(i)}>
              {i + 1}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;

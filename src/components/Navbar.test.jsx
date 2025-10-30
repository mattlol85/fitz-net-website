import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Navbar from './Navbar.jsx';

describe('Navbar Component', () => {
  test('renders navigation links', () => {
    render(
      <BrowserRouter>
        <Navbar />
      </BrowserRouter>
    );

    const laurenLink = screen.getByText(/Lauren Panel/i);
    const infoLink = screen.getByText(/Info/i);

    expect(laurenLink).toBeInTheDocument();
    expect(infoLink).toBeInTheDocument();
  });

  test('renders logo image', () => {
    render(
      <BrowserRouter>
        <Navbar />
      </BrowserRouter>
    );

    const logo = screen.getByAltText(/Fitz-Net Logo/i);
    expect(logo).toBeInTheDocument();
  });

  test('logo links to home page', () => {
    render(
      <BrowserRouter>
        <Navbar />
      </BrowserRouter>
    );

    const logoLink = screen.getByRole('link', { name: /Fitz-Net Logo/i });
    expect(logoLink).toHaveAttribute('href', '/');
  });

  test('Lauren Panel link has correct href', () => {
    render(
      <BrowserRouter>
        <Navbar />
      </BrowserRouter>
    );

    const laurenLink = screen.getByRole('link', { name: /Lauren Panel/i });
    expect(laurenLink).toHaveAttribute('href', '/laurenpanel');
  });

  test('Info link has correct href', () => {
    render(
      <BrowserRouter>
        <Navbar />
      </BrowserRouter>
    );

    const infoLink = screen.getByRole('link', { name: /Info/i });
    expect(infoLink).toHaveAttribute('href', '/info');
  });
});

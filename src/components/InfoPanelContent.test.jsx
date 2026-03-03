import { render, screen } from '@testing-library/react';
import InfoPanelContent from './InfoPanelContent';

describe('InfoPanelContent Component', () => {
  test('renders page title', () => {
    render(<InfoPanelContent />);

    const title = screen.getByText(/About Fitz-Net/i);
    expect(title).toBeInTheDocument();
  });

  test('renders welcome section', () => {
    render(<InfoPanelContent />);

    const welcomeHeading = screen.getByRole('heading', { name: /Welcome/i });
    expect(welcomeHeading).toBeInTheDocument();
  });

  test('renders our services section', () => {
    render(<InfoPanelContent />);

    const servicesHeading = screen.getByRole('heading', { name: /Our Services/i });
    expect(servicesHeading).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /🌐 Fitz-Net Website/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /🔧 Fitz-Net API/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /🔔 Gamerbell/i })).toBeInTheDocument();

    expect(screen.getByText(/Spring Boot backend service/i)).toBeInTheDocument();
    expect(screen.getByText(/Real-time notification service/i)).toBeInTheDocument();
  });

  test('renders technology stack section', () => {
    render(<InfoPanelContent />);

    const techHeading = screen.getByRole('heading', { name: /Technology Stack/i });
    expect(techHeading).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /⚛️ React 19/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^⚡ Vite$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /☕ Spring Boot/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /🍃 MongoDB/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /🔌 WebSockets/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /🧪 Vitest/i })).toBeInTheDocument();
  });

  test('renders features section', () => {
    render(<InfoPanelContent />);

    const featuresHeading = screen.getByRole('heading', { name: /Features/i });
    expect(featuresHeading).toBeInTheDocument();

    expect(screen.getByText(/Dark\/Light theme toggle/i)).toBeInTheDocument();
    expect(screen.getByText(/Fully responsive design/i)).toBeInTheDocument();
  });

  test('renders contact section', () => {
    render(<InfoPanelContent />);

    const contactHeading = screen.getByRole('heading', { name: /Contact/i });
    expect(contactHeading).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /fitznet.org/i });
    expect(link).toHaveAttribute('href', 'https://fitznet.org');
  });

  test('displays current year in footer', () => {
    render(<InfoPanelContent />);

    const currentYear = new Date().getFullYear();
    expect(screen.getByText(new RegExp(currentYear.toString()))).toBeInTheDocument();
  });
});


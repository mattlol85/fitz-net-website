# Fitz-Net Website

A modern, responsive website for fitznet.org built with React and Vite.

## 🚀 Overview

This is the official website for Fitz-Net, featuring a clean, modern design with custom animations and an intuitive user interface. The site includes multiple pages and components, all wrapped in a smooth user experience with a personalized greeting message for first-time visitors.

## ✨ Features

- **Modern React Stack**: Built with React 19.2.0 and powered by Vite for lightning-fast development
- **Dark/Light Theme**: Toggle between dark and light modes with persistent preference storage
- **Responsive Design**: Mobile-first approach ensuring great experience across all devices
- **Client-Side Routing**: React Router DOM for seamless navigation
- **Greeting Message**: Personalized welcome message for first-time visitors using localStorage
- **Custom Branding**: Animated Fitz-Net logo and custom styling
- **Testing Suite**: Comprehensive test coverage with Vitest and Testing Library

## 🛠️ Tech Stack

- **Frontend Framework**: React 19.2.0
- **Build Tool**: Vite 6.0.3
- **Routing**: React Router DOM 7.9.5
- **Testing**: Vitest 4.0.5, @testing-library/react
- **Development**: React SWC plugin for fast refresh
- **Code Quality**: ESLint

## 📋 Prerequisites

- Node.js (v22 or higher recommended)
- npm or yarn package manager
- Java 21+ only if you run your own external Paper server

## 🔧 Installation

1. Clone the repository:
```bash
git clone https://github.com/mattlol85/Fitz-Net.git
cd fitznet-react-website
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
# Copy the example environment file
cp .env.example .env
```

Then edit `.env` with your configuration (see Environment Variables section below).

## 🐳 Docker Deployment

### Quick Start with Docker

Run the website in a Docker container:

```bash
# Using Docker Compose (recommended)
docker-compose up -d

# Or using Docker CLI
docker build -t fitz-net-website .
docker run -d -p 3000:80 --name fitz-net-website fitz-net-website
```

The website will be available at [http://localhost:3000](http://localhost:3000)

### Helper Scripts

For easier Docker management, use the provided helper scripts:

**Windows (PowerShell)**:
```powershell
.\docker-helper.ps1
```

**Linux/Mac**:
```bash
./docker-helper.sh
```

These interactive scripts provide options to:
- Build the Docker image
- Start/stop containers
- View logs
- Rebuild and restart
- Clean up resources
- Check container status

### Multi-Container Setup

The included `docker-compose.yml` supports running multiple services together. See [DOCKER.md](DOCKER.md) for detailed Docker documentation, including:
- Multi-stage build details
- Nginx configuration
- API proxy setup
- Running with other services
- Production deployment

## 🔐 Environment Variables

The application requires the following environment variables to be configured in a `.env` file:

### Required Variables

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `VITE_API_BASE_URL` | Base URL for the Fitz-Net backend API | `/api` (development) or `http://fitznet.doomdns.org:8585` (production) |

### Configuration Details

#### Development Environment
For local development, use the proxied API path to avoid CORS issues:
```env
VITE_API_BASE_URL=/api
```

The Vite development server is configured to proxy requests from `/api/*` to `http://fitznet.doomdns.org:8585` automatically. This is configured in `vite.config.js`.

#### Production Environment
For production builds, use the full backend URL:
```env
VITE_API_BASE_URL=http://api.fitznet.doomdns.org
```

**Note**: The backend server must have CORS properly configured to accept requests from your production domain when using the full URL.

### Backend API Endpoints

The application integrates with the following Fitz-Net backend endpoints:

- `POST /user/create` - Create a new user account
  - Request body: `{ username, email, password }`
  - Response: `{ success, message, id, username, email }`

- `POST /user/login` - Authenticate a user
  - Request body: `{ username, password }`
  - Response: `{ success, message, token, username }`

### Setup Instructions

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set `VITE_API_BASE_URL` according to your environment:
   - **Development**: Use `/api` (default)
   - **Production**: Use `https://api.fitznet.doomdns.org`

3. Restart the development server if it's already running:
   ```bash
   npm start
   ```

## 🚦 Available Scripts

### Development

Start the development server with hot module replacement:
```bash
npm start
# or
npm run dev
```
Opens [http://localhost:3000](http://localhost:3000) in your browser automatically.

Run the bot control service (connects to an external Minecraft server):
```bash
npm run bot
```

### Testing

Run tests in watch mode:
```bash
npm test
```

Run tests with coverage report:
```bash
npm run test:coverage
```

### Production Build

Build the optimized production bundle:
```bash
npm run build
```
Outputs to the `build/` directory with source maps enabled.

### Preview Production Build

Preview the production build locally:
```bash
npm run preview
```


## 🧪 Testing

The project includes comprehensive test coverage for key components:
- App
- BoxLogo
- Footer
- GreetingMessage
- Homepage
- InfoPanelContent
- Navbar
- NoPage
- ThemeToggle

Tests are configured to run with Vitest in a jsdom environment, supporting React Testing Library utilities.

## 🌐 Routes

- `/` or `/home` - Homepage with animated logo
- `/info` - About page with technology stack and features information
- `*` - 404 Not Found page

## 🤖 Minecraft Bot Notes

- This repo does not bundle or run a Paper server anymore.
- Configure the external server in `bot/.env` (`MC_SERVER_HOST`, `MC_SERVER_PORT`, `MC_VERSION`, `MC_AUTH`).
- For `MC_AUTH=offline`, your external server must allow offline mode.
- For `MC_AUTH=microsoft`, use credentials/session flow compatible with your Mineflayer setup.

## 🎨 Customization

The application features custom styling through modular CSS files for each component. Key visual elements include:
- **Theme System**: Complete dark/light mode with CSS variables for consistent theming
- **Theme Toggle**: Moon/sun icon button in the navigation bar to switch themes
- **Persistent Preferences**: Theme choice saved in localStorage
- Custom Fitz-Net logo with multiple variations (straight, offset, animated)
- Responsive navigation bar
- Dynamic footer with copyright information
- Greeting message modal for first-time visitors

### Theme Variables

The theme system uses CSS custom properties for easy customization:
- Background colors (primary, secondary)
- Text colors (primary, secondary)
- Border and shadow colors
- Navigation and footer styling
- Button and link colors

All components automatically adapt to the selected theme.

## 📦 Build Output

The production build:
- Outputs to `build/` directory
- Includes source maps for debugging
- Optimizes and minifies all assets
- Includes Progressive Web App manifest

## 🤝 Contributing

When contributing to this project:
1. Ensure all tests pass with `npm test`
2. Follow the existing code style
3. Update tests for new features
4. Keep component styles modular

## 📄 License

Private project - All rights reserved.

## 👤 Author

**Matthew Fitzgerald**
- Website: [fitznet.org](https://fitznet.org)

## 🔗 Repository

[https://github.com/mattlol85/Fitz-Net](https://github.com/mattlol85/Fitz-Net)

---

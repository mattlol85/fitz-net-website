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

- Node.js (v14 or higher recommended)
- npm or yarn package manager

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

## 🚦 Available Scripts

### Development

Start the development server with hot module replacement:
```bash
npm start
# or
npm run dev
```
Opens [http://localhost:3000](http://localhost:3000) in your browser automatically.

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

## 📁 Project Structure

```
fitz-net-website/
├── public/              # Static assets
│   ├── favicon.ico
│   ├── manifest.json
│   └── logo files
├── src/
│   ├── components/      # React components
│   │   ├── Navbar.jsx
│   │   ├── Footer.jsx
│   │   ├── Homepage.jsx
│   │   ├── BoxLogo.jsx
│   │   ├── GreetingMessage.jsx
│   │   ├── ThemeToggle.jsx
│   │   ├── InfoPanelContent.jsx
│   │   ├── NoPage.jsx
│   │   ├── Card.jsx
│   │   └── Slider.jsx
│   ├── css/             # Component styles
│   ├── scripts/         # Utility scripts
│   ├── App.jsx          # Main application component
│   └── index.jsx        # Application entry point
├── index.html           # HTML template
├── vite.config.js       # Vite configuration
├── package.json         # Project dependencies```

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

Built with ❤️ using React and Vite

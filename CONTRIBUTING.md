# Contributing to roon-extension-ikea-tradfri

Thank you for your interest in contributing to this project! Here are some guidelines to help you get started.

## 📋 Getting Started

### Prerequisites
- Node.js >= 16.0.0
- npm or yarn
- Git

### Installation

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/roon-extension-ikea-tradfri.git
   cd roon-extension-ikea-tradfri
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

## 🏗️ Project Structure

```
roon-extension-ikea-tradfri/
├── app.js                 # Main entry point - Roon API initialization
├── connection.js          # IKEA Tradfri gateway connection logic
├── devices.js             # Device utility functions
├── state.js               # Centralized state management
├── tradfri-manager.js     # IKEA Tradfri device management
├── settings-manager.js    # Roon settings UI and validation
├── package.json           # Project configuration and dependencies
├── Dockerfile             # Docker container configuration
├── .eslintrc.json         # ESLint configuration
├── .github/workflows/     # GitHub Actions CI/CD workflows
└── README.md              # User documentation
```

## 🔧 Development

### Running the Extension

```bash
# Start the extension
node .

# With debug logging
LOG_LEVEL=debug node .
```

### Code Style

This project uses ESLint for code style enforcement. Run the linter:

```bash
npm run lint

# Auto-fix issues
npm run lint:fix
```

### Adding New Features

1. Create a new branch for your feature:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes
3. Add tests if applicable
4. Ensure all linting passes
5. Commit your changes with descriptive messages
6. Push to your fork and create a pull request

## 📝 Commit Messages

Please use clear, descriptive commit messages. Follow this format:

```
type(scope): description

body

footer
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Example:
```
feat(tradfri): add support for light devices

- Add device type detection
- Implement brightness control
- Update device listing

Fixes #123
```

## 🧪 Testing

Currently, this project uses manual testing. Please test your changes by:

1. Running the extension locally
2. Testing with your IKEA Tradfri gateway
3. Verifying all existing functionality still works
4. Testing edge cases (network issues, gateway restarts, etc.)

## 📄 Pull Requests

When submitting a pull request:

1. Use a clear, descriptive title
2. Include a detailed description of the changes
3. Reference any related issues
4. Ensure all CI checks pass
5. Keep PRs focused on a single feature or fix

## 🎫 Reporting Issues

When reporting issues, please include:

1. A clear description of the problem
2. Steps to reproduce
3. Expected vs actual behavior
4. Your environment (Node.js version, OS, etc.)
5. Relevant log output (with `LOG_LEVEL=debug` if possible)
6. IKEA Tradfri gateway model and firmware version

## 📜 License

By contributing to this project, you agree that your contributions will be licensed under the Apache License 2.0.

![image](https://github.com/user-attachments/assets/7cc32cb9-26ac-4f93-930b-53063ab8d143)
# Bluesky Auto-Follow Back

A Node.js application that automatically follows back users who follow you on Bluesky.

## Features

- Monitors your Bluesky account for new followers
- Automatically follows back new followers
- Rate limiting protection
- Error handling and retry logic
- Detailed logging of all actions

## Setup

1. Clone the repository:
```bash
git clone [your-repo-url]
cd blueskyautofollowback
```

2. Install dependencies:
```bash
npm install
```

3. Create a .env file:
```bash
cp .env.example .env
```

4. Edit the .env file with your Bluesky credentials:
```
BLUESKY_USERNAME=your-username
BLUESKY_PASSWORD=your-app-password
```

## Usage

Run the application:
```bash
npm run start
```

The application will:
- Monitor your followers every 5 minutes
- Automatically follow back any new followers
- Log all actions to the console

To stop the application, press Ctrl+C.

## Development

Build the TypeScript code:
```bash
npm run build
```

## License

MIT License - See LICENSE file for details

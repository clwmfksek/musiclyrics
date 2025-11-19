# Music Lyrics Video Generator

An Apple-style music video generator that automatically syncs lyrics with audio and creates stunning video clips. This project allows users to upload audio, process lyrics, and customize subtitles with a premium, modern interface.

## Features

- **Audio Processing**: Upload audio files to automatically generate or sync lyrics.
- **Precise Subtitle Control**:
  - Accurate subtitle-audio synchronization.
  - Manual time editing for subtitles.
  - Automatic overlap prevention.
- **Visual Customization**:
  - Apple-style design aesthetics.
  - Adjustable font size and vertical positioning.
  - Dynamic background generation based on mood/content.
- **Lyrics Management**:
  - Support for separate lyrics file upload.
  - Intelligent segmentation for readability.
  - Korean and English subtitle support.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Language**: TypeScript
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/clwmfksek/musiclyrics.git
   cd musiclyrics
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env.local` file in the root directory and add necessary API keys (e.g., OpenAI API key for lyrics processing).
   ```env
   OPENAI_API_KEY=your_api_key_here
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Usage

1. **Upload Audio**: Drag and drop or select an audio file on the home page.
2. **Upload/Edit Lyrics**: Provide a lyrics file or let the AI generate them.
3. **Customize**: Use the editor to adjust subtitle timing, styles, and background visuals.
4. **Export**: Generate the final video with synced lyrics.

## License

This project is licensed under the MIT License.

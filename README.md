# Lincoln EMS Truck Tracker

A comprehensive web application for tracking maintenance, equipment, and status of Lincoln EMS ambulance fleet.

## Features

- **Authentication**: Secure login system using Google Firebase
- **Fleet Management**: Track 9 ambulance units (52, 53, 55, 56, 57, 58, 61, 62, 63)
- **Maintenance Tracking**: Log oil changes, inspections, brake changes, tire changes, and mileage
- **Equipment Management**: Track stretchers, Lucas devices, and Life Pak 15s with serial numbers
- **Status Monitoring**: Real-time status updates (In Service/Out of Service)
- **Printing**: Professional printouts for individual trucks and fleet overview
- **Data Export**: JSON export functionality for backup and analysis
- **Audit Trail**: Complete logging of all data changes with user tracking
- **Responsive Design**: Mobile-friendly interface built with Tailwind CSS

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **Backend**: Google Firebase (Authentication & Firestore)
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **State Management**: React Context API
- **Form Handling**: React Hook Form with Zod validation

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Google Firebase project

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd trucks
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Firebase Configuration

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication (Email/Password)
3. Create a Firestore database
4. Get your Firebase configuration

### 4. Environment Variables

Copy the environment template and fill in your Firebase credentials:

```bash
cp env.example .env
```

Edit `.env` with your Firebase configuration:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_APP_ENV=development
```

### 5. Firebase Security Rules

Set up Firestore security rules in your Firebase console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 6. Initialize Database

The application will automatically create the necessary collections when you first add data. You can also manually create the initial truck records in Firestore.

### 7. Run the Application

```bash
# Development mode
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The application will be available at `http://localhost:3000`

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Header.tsx      # Application header with navigation
│   ├── TruckCard.tsx   # Individual truck display card
│   └── MaintenanceForm.tsx # Maintenance and equipment entry form
├── contexts/           # React contexts for state management
│   ├── AuthContext.tsx # Authentication state
│   └── TruckContext.tsx # Truck data state
├── pages/              # Main application pages
│   ├── LoginPage.tsx   # User authentication page
│   └── DashboardPage.tsx # Main dashboard with truck overview
├── services/           # Firebase and API services
│   └── firebase.ts     # Firebase operations and real-time listeners
├── types/              # TypeScript type definitions
│   └── index.ts        # All application interfaces
├── config/             # Configuration files
│   └── firebase.ts     # Firebase initialization
├── App.tsx             # Main application component
└── main.tsx            # Application entry point
```

## Usage

### Authentication
1. Navigate to the login page
2. Enter your assigned username (email) and password
3. Access the truck tracking dashboard

### Adding Maintenance Records
1. Click "Show Maintenance Form" on the dashboard
2. Select the truck unit
3. Choose maintenance type and fill in details
4. Submit to automatically update truck status

### Managing Equipment
1. Switch to the Equipment tab in the maintenance form
2. Select truck and equipment type
3. Enter serial number and notes
4. Add or remove equipment as needed

### Printing and Exporting
- **Print Individual**: Click the print icon on any truck card
- **Print All**: Use the Print button in the header
- **Export Data**: Use the Export button to download JSON data

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Code Style

- Follow TypeScript best practices
- Use functional components with hooks
- Maintain consistent naming conventions
- Keep components under 200-300 lines
- Use Tailwind CSS utility classes

## Deployment

### Local Development
The application runs locally for development and testing.

### Production Deployment
1. Build the application: `npm run build`
2. Deploy the `dist` folder to your web server
3. Configure Firebase for production environment
4. Update environment variables for production

### Firebase Hosting (Recommended)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

## Security Features

- Firebase Authentication with email/password
- Firestore security rules
- Protected routes requiring authentication
- Audit logging of all data changes
- User activity tracking

## Support and Maintenance

- All data changes are logged with timestamps and user information
- Regular backups through Firebase
- Export functionality for data preservation
- Comprehensive error handling and user feedback

## License

This project is proprietary software for Lincoln EMS use only.

## Contributing

For internal development and updates, please follow the established coding standards and testing procedures.



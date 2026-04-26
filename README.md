# Evnt - Event Booking Platform

A modern, full-stack event booking platform built with Node.js, Express, SQLite, and vanilla JavaScript. This platform allows users to discover, register for, and host events with proper database integration and authentication.

## 🚀 Features

### For Users
- **Event Discovery**: Browse and search events with advanced filtering
- **Event Registration**: Easy registration for events with capacity management
- **User Profiles**: Personal profiles with preferences and history
- **Dashboard**: View registered events and personal statistics

### For Organizers
- **Event Creation**: Create and manage events with detailed information
- **Attendee Management**: Track registrations and attendee counts
- **Event Analytics**: Monitor event performance and statistics
- **Event Updates**: Edit or cancel events as needed

### Technical Features
- **Database Integration**: Full SQLite database with proper SQL schema
- **Authentication**: JWT-based auth with Google OAuth support
- **RESTful API**: Clean, documented API endpoints
- **Responsive Design**: Modern UI that works on all devices
- **Real-time Updates**: Live attendee counts and availability

## 🛠️ Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **SQLite3** - Database
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing
- **Passport.js** - OAuth authentication

### Frontend
- **Vanilla JavaScript** - No framework dependencies
- **CSS3** - Modern styling with CSS variables
- **HTML5** - Semantic markup
- **Responsive Design** - Mobile-first approach

## 📁 Project Structure

```
Evnt App/
├── database.js          # Database setup and schema
├── server.js            # Express server and API routes
├── app.js               # Frontend JavaScript application
├── index.html           # Main HTML file
├── styles.css           # Styles and responsive design
├── package.json         # Dependencies and scripts
├── database.sqlite      # SQLite database file
└── README.md            # This documentation
```

## 🗄️ Database Schema

The application uses a well-designed SQLite database with the following tables:

### Users Table
- User authentication and profile information
- Support for both email/password and Google OAuth
- Role-based access control (member, organizer, admin)

### Events Table
- Comprehensive event information
- Category and type classification
- Pricing and capacity management
- Status tracking (draft, published, cancelled, completed)

### Registrations Table
- User event registrations
- Payment status tracking
- Registration history

### Event Categories Table
- Pre-defined event categories
- Color coding and icons
- Category management

### User Profiles Table
- Extended user information
- Professional details
- Preferences and interests

## 🔧 Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation Steps

1. **Clone/Download the project**
   ```bash
   cd "Evnt App"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file with the following variables:
   ```
   PORT=3000
   JWT_SECRET=your-secret-key
   SESSION_SECRET=your-session-secret
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   ```

4. **Start the application**
   ```bash
   npm start
   # or
   node server.js
   ```

5. **Access the application**
   Open your browser and navigate to `http://localhost:3000`

## 📚 API Documentation

### Authentication Endpoints

#### POST /api/auth/signup
Register a new user account.
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "role": "member" // optional: "member", "organizer", "admin"
}
```

#### POST /api/auth/login
Authenticate user and receive JWT token.
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### GET /api/auth/me
Get current user information (requires authentication).

#### POST /api/auth/logout
Logout and clear authentication token.

### Event Endpoints

#### GET /api/events
Get all published events with optional filtering.
Query parameters:
- `category`: Filter by category
- `type`: Filter by type (online, offline, hybrid)
- `search`: Search in title and description
- `featured`: Get featured events only
- `limit`: Number of results (default: 20)
- `offset`: Pagination offset

#### GET /api/events/:id
Get detailed information about a specific event.

#### POST /api/events
Create a new event (requires authentication, organizer role).
```json
{
  "title": "Event Title",
  "description": "Event description",
  "category": "conference",
  "type": "offline",
  "startDate": "2024-12-31T18:00:00Z",
  "endDate": "2024-12-31T22:00:00Z",
  "location": "Venue Name",
  "address": "Full Address",
  "capacity": 100,
  "price": 45.00,
  "imageUrl": "https://example.com/image.jpg"
}
```

#### PUT /api/events/:id
Update an existing event (requires authentication, event owner).

#### DELETE /api/events/:id
Delete an event (requires authentication, event owner).

### Registration Endpoints

#### POST /api/events/:id/register
Register a user for an event (requires authentication).

#### DELETE /api/events/:id/register
Cancel event registration (requires authentication).

#### GET /api/organizer/events
Get events hosted by the current user (requires authentication).

#### GET /api/participant/registrations
Get events the user is registered for (requires authentication).

### User Endpoints

#### GET /api/user/profile
Get current user profile (requires authentication).

#### PUT /api/user/profile
Update user profile (requires authentication).

#### GET /api/categories
Get all event categories.

## 🎨 Frontend Architecture

The frontend is built with a class-based JavaScript architecture for better organization and maintainability:

### Main Components

1. **EventBookingApp Class**: Main application controller
2. **Authentication System**: Login, signup, and session management
3. **Event Management**: Event creation, browsing, and registration
4. **Dashboard**: User-specific event management
5. **UI Components**: Modals, forms, and interactive elements

### Key Features

- **Component-based Architecture**: Modular and maintainable code
- **API Integration**: Clean API calls with error handling
- **State Management**: Centralized application state
- **Responsive Design**: Mobile-first approach
- **Modern UI/UX**: Clean, intuitive interface

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt for secure password storage
- **Input Validation**: Server-side validation for all inputs
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: Input sanitization and output encoding
- **CORS Configuration**: Proper cross-origin resource sharing

## 📱 Responsive Design

The application features a fully responsive design that works seamlessly across:

- **Desktop**: Full-featured experience with all functionality
- **Tablet**: Optimized layout for touch interactions
- **Mobile**: Streamlined interface for small screens

## 🚀 Deployment

### Production Deployment

1. **Environment Setup**
   - Set production environment variables
   - Configure database for production
   - Set up SSL certificates

2. **Database Migration**
   - The database schema is automatically created on first run
   - Consider using a production-grade database for scaling

3. **Process Management**
   - Use PM2 or similar for process management
   - Set up proper logging and monitoring

### Docker Deployment (Optional)

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

## 🤝 Contributing

This project is designed as a demonstration of modern web development practices and database integration. Feel free to extend and modify it for your specific needs.

## 📄 License

This project is provided as-is for educational and demonstration purposes.

## 🆘 Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Ensure SQLite3 is properly installed
   - Check file permissions for database.sqlite

2. **Authentication Issues**
   - Verify JWT_SECRET is set in environment
   - Check token expiration settings

3. **Port Conflicts**
   - Change PORT in environment variables
   - Check if port 3000 is already in use

4. **Google OAuth Issues**
   - Verify Google Client ID and Secret
   - Ensure correct callback URL configuration

### Development Tips

- Use browser developer tools for debugging
- Check server logs for API errors
- Test with different user roles and permissions
- Verify responsive design on various screen sizes

## 🎯 Future Enhancements

Potential improvements for production use:

- **Payment Integration**: Stripe or PayPal for paid events
- **Email Notifications**: Event reminders and updates
- **File Uploads**: Event images and attachments
- **Advanced Search**: Full-text search capabilities
- **Social Features**: Event sharing and social integration
- **Analytics Dashboard**: Advanced event analytics
- **Mobile App**: Native mobile applications
- **Multi-language Support**: Internationalization

---

**Built with ❤️ for demonstrating modern web development and database integration**

# Encreasl CMS

Content Management System for Encreasl powered by PayloadCMS 3.0

## Overview

This is the dedicated CMS application for managing blog posts, services, and media content for the Encreasl platform.

## Features

- **Blog Posts**: Rich text editor for creating and managing blog content
- **Services**: Manage service offerings with pricing, features, and media
- **Media Library**: Upload and organize images and files
- **User Management**: Admin user authentication and roles
- **SEO Support**: Built-in SEO fields for all content types

## Quick Start

### Prerequisites

- Node.js 18+ or 20+
- pnpm package manager
- PostgreSQL database (Supabase recommended)

### Setup

1. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   Update the `.env` file with your database connection string and other settings.

2. **Install Dependencies**
   ```bash
   pnpm install
   ```

3. **Database Setup**
   - Create a PostgreSQL database (or use Supabase)
   - Update `DATABASE_URI` in `.env` with your connection string

4. **Start Development Server**
   ```bash
   pnpm run dev
   ```

5. **Access Admin Panel**
   - Open http://localhost:3001/admin
   - Create your first admin user

3. `pnpm install && pnpm dev` to install dependencies and start the dev server
4. open `http://localhost:3000` to open the app in your browser

That's it! Changes made in `./src` will be reflected in your app. Follow the on-screen instructions to login and create your first admin user. Then check out [Production](#production) once you're ready to build and serve your app, and [Deployment](#deployment) when you're ready to go live.

#### Docker (Optional)

If you prefer to use Docker for local development instead of a local MongoDB instance, the provided docker-compose.yml file can be used.

To do so, follow these steps:

- Modify the `MONGODB_URI` in your `.env` file to `mongodb://127.0.0.1/<dbname>`
- Modify the `docker-compose.yml` file's `MONGODB_URI` to match the above `<dbname>`
- Run `docker-compose up` to start the database, optionally pass `-d` to run in the background.

## How it works

The Payload config is tailored specifically to the needs of most websites. It is pre-configured in the following ways:

### Collections

See the [Collections](https://payloadcms.com/docs/configuration/collections) docs for details on how to extend this functionality.

- #### Users (Authentication)

  Users are auth-enabled collections that have access to the admin panel.

  For additional help, see the official [Auth Example](https://github.com/payloadcms/payload/tree/main/examples/auth) or the [Authentication](https://payloadcms.com/docs/authentication/overview#authentication-overview) docs.

- #### Media

  This is the uploads enabled collection. It features pre-configured sizes, focal point and manual resizing to help you manage your pictures.

### Docker

Alternatively, you can use [Docker](https://www.docker.com) to spin up this template locally. To do so, follow these steps:

1. Follow [steps 1 and 2 from above](#development), the docker-compose file will automatically use the `.env` file in your project root
1. Next run `docker-compose up`
1. Follow [steps 4 and 5 from above](#development) to login and create your first admin user

That's it! The Docker instance will help you get up and running quickly while also standardizing the development environment across your teams.

## Questions

If you have any issues or questions, reach out to us on [Discord](https://discord.com/invite/payload) or start a [GitHub discussion](https://github.com/payloadcms/payload/discussions).

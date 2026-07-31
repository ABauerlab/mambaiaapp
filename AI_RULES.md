# AI Rules & Guidelines

## Tech Stack Overview
- **React 19 & TypeScript**: Core UI library utilizing strongly typed standard React components and modern hooks.
- **TanStack Start & TanStack Router**: Full-stack framework with file-based routing, server functions, and type-safe navigation.
- **Tailwind CSS v4**: Utility-first CSS styling engine integrated via `@tailwindcss/vite` and enhanced with `tw-animate-css`.
- **shadcn/ui & Radix UI Primitives**: Unstyled, accessible UI component primitives paired with Tailwind, `clsx`, `tailwind-merge`, and `class-variance-authority`.
- **TanStack React Query**: Asynchronous state management for server fetching, caching, and optimistic mutations.
- **React Hook Form & Zod**: Schema-driven form validation and type-safe form state handling using `@hookform/resolvers`.
- **Lucide React**: Icon library providing consistent vector icons across the interface.
- **Supabase JS Client**: Backend integration for database queries, real-time sync, and authentication services.
- **Recharts**: Responsive chart library for dashboards, analytics, and data visualizations.
- **dnd-kit, Embla Carousel & Vaul**: Utility libraries for interactive drag-and-drop lists (`@dnd-kit`), sliding carousels (`embla-carousel-react`), and responsive bottom drawers (`vaul`).

## Library Usage Rules

### 1. UI Components & Layout
- **shadcn/ui & Radix UI**: Use shadcn/ui components built on Radix UI for interface elements like Buttons, Dialogs, Dropdowns, Tabs, Tooltips, Accordions, and Popovers.
- **Tailwind CSS**: Use utility classes exclusively for custom layouts, positioning, typography, grid, and colors. Merge dynamic classes with `cn()` utility.
- **Lucide React**: Primary icon library. Use `lucide-react` icons throughout the application; do not mix in alternative icon packages.
- **Vaul**: Use `vaul` when creating drawer components, especially for mobile-optimized bottom sheets.
- **Embla Carousel**: Use `embla-carousel-react` when creating image or content carousels and multi-slide components.

### 2. Routing & Navigation
- **TanStack Router**: Define file-based routes and handle navigation using TanStack Router hooks (`useNavigate`, `useParams`, `useSearch`) and `<Link>` components.
- Keep route handlers and loaders strictly type-safe according to TanStack Router definitions.

### 3. Data Fetching & Server Logic
- **TanStack React Query**: Manage client async state, caching, background refetching, and mutations using `useQuery` and `useMutation`.
- **TanStack Start Server Functions**: Use `createServerFn` for server-side code execution, API endpoints, and sensitive server operations.

### 4. Forms & Input Validation
- **React Hook Form**: Standard choice for all form management.
- **Zod**: Standard choice for schema creation, runtime data validation, and parameter parsing, bound to forms using `@hookform/resolvers/zod`.

### 5. Database & Authentication
- **Supabase (`@supabase/supabase-js`)**: Standard library for interacting with the database, user authentication, and storage assets.

### 6. Specialized Utilities
- **Recharts**: Use Recharts components (`ResponsiveContainer`, `BarChart`, `LineChart`, `PieChart`, etc.) for data charts and metrics visualization.
- **dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`)**: Use `@dnd-kit` for drag-and-drop features like reorderable lists and kanban boards.
- **Sonner**: Use `toast` from `sonner` for displaying toast notifications and user alerts.
- **date-fns**: Use `date-fns` for date formatting, calculations, and date parsing.
- **jsPDF**: Use `jspdf` for generating downloadable PDF documents client-side.

## Code Standards
- Keep components small, focused, and organized within `src/components/` and pages within `src/routes/` or `src/pages/`.
- Always maintain full TypeScript type coverage without using `any`.

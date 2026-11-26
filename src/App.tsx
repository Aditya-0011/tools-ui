import { lazy } from "react";

import { createBrowserRouter, RouterProvider } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "sonner";

import { queryClient } from "@/api/query-client";

import { RootLayout } from "@/layouts/Root";
import { RequireTool } from "@/components/RequirePermission";

const Home = lazy(() => import("@/pages/Home"));
const Folio = lazy(() => import("@/pages/Folio"));
const Stencil = lazy(() => import("@/pages/Stencil"));
import NotFound from "@/pages/NotFound";

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      {
        path: "/folio",
        element: (
          <RequireTool slug="folio">
            <Folio />
          </RequireTool>
        ),
      },
      {
        path: "/stencil",
        element: (
          <RequireTool slug="stencil">
            <Stencil />
          </RequireTool>
        ),
      },
    ],
  },
  { path: "*", element: <NotFound /> },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ReactQueryDevtools initialIsOpen={false} />
      <Toaster richColors position="top-right" />
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

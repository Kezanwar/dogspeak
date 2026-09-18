import React from "react";
import { useRoutes, type RouteObject } from "react-router-dom";

import Signin from "@app/pages/guest/sign-in";
import GuestGuard from "@app/hocs/guest-guard";
import AuthGuard from "@app/hocs/auth-guard";
import DashboardLayout from "@app/layouts/dashboard";
import Room from "@app/pages/dashboard/room";

const paths: RouteObject[] = [
  {
    path: "/",
    element: (
      <AuthGuard>
        <DashboardLayout />
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: <Room />,
      },
    ],
  },
  {
    path: "/sign-in",
    element: (
      <GuestGuard>
        <Signin />
      </GuestGuard>
    ),
  },
];

const Routes: React.FC = () => useRoutes(paths);

export default Routes;

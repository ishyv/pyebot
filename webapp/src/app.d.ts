declare global {
  namespace App {
    interface Locals {
      session: import("$lib/server/auth").DashboardSession | null;
    }
  }
}

export {};

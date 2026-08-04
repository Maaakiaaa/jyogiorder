import { Metadata } from "next";
import StaffHub from "@/app/components/staff/StaffHub";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function StaffPage() {
  return <StaffHub />;
}

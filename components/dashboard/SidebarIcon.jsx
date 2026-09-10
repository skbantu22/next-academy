import {
  Award, BookOpen, CalendarDays, Contact, Files, GraduationCap,
  LayoutDashboard, Mail, Megaphone, MessageCircle, Presentation, QrCode, ScanQrCode,
  Settings, ShoppingBag, Sparkles, Trophy, UserRound, UsersRound, WalletCards,
} from "lucide-react";

const icons = {
  Dashboard: LayoutDashboard, Students: UsersRound, Teacher: Presentation,
  Teachers: Presentation, Training: BookOpen, "My Training": BookOpen,
  Event: CalendarDays, Events: CalendarDays, Finance: WalletCards,
  Documents: Files, "My Shop": ShoppingBag, User: UserRound, Users: UserRound,
  Chat: MessageCircle, Achievement: Trophy, Achievements: Trophy,
  "ID Card": Contact, "ID Cards": Contact, "Scan QR Code": ScanQrCode,
  "QR Scanner": QrCode, Attendance: Award, Certificates: Award,
  Settings, Activities: Award, Promote: Megaphone, "AI Assistant": Sparkles,
  "Contact Inquiries": Mail,
};

export default function SidebarIcon({ name, className = "h-5 w-5" }) {
  const Icon = icons[name] || GraduationCap;
  return <Icon className={className} strokeWidth={1.9} aria-hidden="true" />;
}

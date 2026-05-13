export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4 text-text-primary">
      {children}
    </div>
  );
}

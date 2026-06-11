export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">مدار AI</h1>
          <p className="text-muted-foreground mt-1 text-sm">المستشار المالي الذكي للمطاعم</p>
        </div>
        {children}
      </div>
    </div>
  );
}

import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import { CheckCircle2, XCircle, AlertCircle, Info, Loader2 } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      expand={false}
      richColors
      closeButton
      duration={4000}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-xl group-[.toaster]:rounded-xl group-[.toaster]:backdrop-blur-sm",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-sm",
          actionButton: 
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg group-[.toast]:font-medium group-[.toast]:shadow-sm",
          cancelButton: 
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg",
          closeButton:
            "group-[.toast]:bg-background group-[.toast]:border-border group-[.toast]:text-muted-foreground hover:group-[.toast]:text-foreground",
          success:
            "group-[.toaster]:border-green-200 group-[.toaster]:bg-green-50 group-[.toaster]:text-green-900 dark:group-[.toaster]:border-green-800 dark:group-[.toaster]:bg-green-950/90 dark:group-[.toaster]:text-green-100",
          error:
            "group-[.toaster]:border-red-200 group-[.toaster]:bg-red-50 group-[.toaster]:text-red-900 dark:group-[.toaster]:border-red-800 dark:group-[.toaster]:bg-red-950/90 dark:group-[.toaster]:text-red-100",
          warning:
            "group-[.toaster]:border-amber-200 group-[.toaster]:bg-amber-50 group-[.toaster]:text-amber-900 dark:group-[.toaster]:border-amber-800 dark:group-[.toaster]:bg-amber-950/90 dark:group-[.toaster]:text-amber-100",
          info:
            "group-[.toaster]:border-blue-200 group-[.toaster]:bg-blue-50 group-[.toaster]:text-blue-900 dark:group-[.toaster]:border-blue-800 dark:group-[.toaster]:bg-blue-950/90 dark:group-[.toaster]:text-blue-100",
        },
      }}
      icons={{
        success: <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />,
        error: <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />,
        warning: <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
        info: <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
        loading: <Loader2 className="h-5 w-5 text-primary animate-spin" />,
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
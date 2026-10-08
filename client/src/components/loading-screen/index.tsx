import Spinner from "@app/components/spinner";

// Boot splash while the session check (auth.initialize) is in flight.
const LoadingScreen = () => {
  return (
    <div className="bg-background text-foreground flex h-svh w-full flex-col items-center justify-center">
      <Spinner size={28} label="checking your session" />
    </div>
  );
};

export default LoadingScreen;

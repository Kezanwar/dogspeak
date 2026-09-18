import ToggleTheme from "@app/components/buttons/toggle-theme";
import { Typography } from "@app/components/ui/typography";

const GuestHeader = () => {
  return (
    <div className="px-6 py-4">
      <div className="bg-paper text-foreground flex items-center justify-between">
        <Typography variant={"h4"}>DogSpeak</Typography>
        <ToggleTheme />
      </div>
    </div>
  );
};

export default GuestHeader;

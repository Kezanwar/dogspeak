import ToggleTheme from "@app/components/buttons/toggle-theme";
import { Typography } from "@app/components/ui/typography";
import NavUser from "./nav-user";

const BasicHeader = () => {
  return (
    <div className="px-6 py-4">
      <div className="bg-paper text-foreground flex items-center justify-between">
        <Typography variant={"h4"}>DogSpeak</Typography>
        <div className="flex items-center gap-2">
          <ToggleTheme />
          <NavUser />
        </div>
      </div>
    </div>
  );
};

export default BasicHeader;

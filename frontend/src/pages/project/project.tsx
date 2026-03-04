import ProjectList from "../../components/tables/lists/projectList";
import { useGetCurrentUserQuery } from "../../redux/services/authApi";

export default function Project() {
  const { data: loggedUser, isLoading: userLoading } = useGetCurrentUserQuery();
  const userId = loggedUser?.user_id;
  // console.log("userrrrrrrrrrrrrrrrrrrrrrrrrrrrrr", userId);

  const id = loggedUser?.institute?.institute_id;
  // console.log("here is iddddddddddddddddddddddddddddddddddddddddddddddd", id);

  return (
    <>
      <ProjectList insistitute_id={id || ""} userType="external_user" />
    </>
  );
}

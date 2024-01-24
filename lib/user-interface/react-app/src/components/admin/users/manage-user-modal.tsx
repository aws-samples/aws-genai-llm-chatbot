import { useContext, useState } from "react";
import {
  AdminUsersManagementAction,
  UserData,
  UserRole,
} from "../../../common/types";
import {
  Alert,
  Button,
  Form,
  FormField,
  Input,
  Modal,
  Select,
  SelectProps,
  SpaceBetween,
} from "@cloudscape-design/components";
import { UserContext } from "../../../common/user-context";

export interface ManageUserModalProps {
  userData?: UserData;
  visible: boolean;
  onDismiss: () => void;
  onSave: (userData: UserData) => void;
  adminAction: AdminUsersManagementAction;
}

export default function ManageUserModal(
  manageUsersModalProps: ManageUserModalProps
) {
  const userContext = useContext(UserContext);
  const userRoleOptions: SelectProps.Option[] = [
    { label: "Admin", value: "chatbot_admin" },
    { label: "Workspaces Manager", value: "chatbot_workspaces_manager" },
    { label: "Workspaces User", value: "chatbot_workspaces_user" },
    { label: "Chatbot User", value: "chatbot_user" },
  ];
  const getCurrentRoleSelection = () => {
    if (!manageUsersModalProps.userData) return defaultRole;
    const role = manageUsersModalProps.userData.role;
    return userRoleOptions.find((option) => option.value === role);
  };

  const dismissModal = () => {
    manageUsersModalProps.onDismiss();
    setInputName("");
    setInputEmail("");
    setInputPhoneNumber("");
    setInputRole(defaultRole);
  }

  const [inputName, setInputName] = useState<string>(
    manageUsersModalProps.userData?.name ?? ""
  );
  const [inputEmail, setInputEmail] = useState(
    manageUsersModalProps.userData?.email ?? ""
  );
  const [inputPhoneNumber, setInputPhoneNumber] = useState(
    manageUsersModalProps.userData?.phoneNumber ?? ""
  );
  const defaultRole: SelectProps.Option = {
    label: "Chatbot User",
    value: "chatbot_user",
  };
  const [inputRole, setInputRole] = useState(getCurrentRoleSelection());


  return (
    <Modal
      visible={manageUsersModalProps.visible}
      header={manageUsersModalProps.userData ? "Edit User Details" : "Add User"}
      onDismiss={dismissModal}
    >
      <Form
        variant="embedded"
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={dismissModal} variant="normal">
              Cancel
            </Button>
            <Button
              onClick={() => {
                manageUsersModalProps.onSave({
                  email: inputEmail,
                  name: inputName,
                  phoneNumber: inputPhoneNumber,
                  role: inputRole
                    ? (inputRole.value as UserRole)
                    : (defaultRole.value as UserRole),
                  previousEmail:
                    manageUsersModalProps.adminAction ===
                      AdminUsersManagementAction.EDIT
                      ? manageUsersModalProps.userData?.email
                      : undefined,
                });
              }}
              variant="primary"
            >
              Save
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="s" direction="vertical">
          {manageUsersModalProps.userData?.email == userContext.userEmail ? (
            <Alert type="warning">
              <SpaceBetween size="xxs">
                <strong>Warning</strong>
                <p>
                  You are currently editing your own user. Changing details will
                  directly impact your user and may cause you to lose access if
                  you change the email to something you cannot access.
                  <br />
                  To ensure the chatbot always has at least one admin, changing
                  your own user role from "Admin" is disabled.
                </p>
              </SpaceBetween>
            </Alert>
          ) : null}
          <FormField label="Name">
            <Input
              ariaRequired={true}
              inputMode="text"
              value={inputName}
              onChange={({ detail }) => setInputName(detail.value)}
            />
          </FormField>
          <FormField label="Email">
            <Input
              inputMode="email"
              ariaRequired={true}
              value={inputEmail}
              onChange={({ detail }) => setInputEmail(detail.value)}
            />
          </FormField>
          <FormField label="Phone Number">
            <Input
              inputMode="tel"
              type="text"
              value={inputPhoneNumber}
              onChange={({ detail }) => setInputPhoneNumber(detail.value)}
            />
          </FormField>
          <FormField label="User Role">
            <Select
              selectedOption={inputRole || null}
              onChange={({ detail }) => setInputRole(detail.selectedOption)}
              options={userRoleOptions}
              disabled={userContext.userEmail == inputEmail}
            ></Select>
          </FormField>
        </SpaceBetween>
      </Form>
    </Modal>
  );
}

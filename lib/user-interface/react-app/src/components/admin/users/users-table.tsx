import {
  Alert,
  Button,
  ButtonDropdown,
  ButtonDropdownProps,
  Flashbar,
  FlashbarProps,
  Header,
  Modal,
  SpaceBetween,
  Table,
  TableProps,
} from "@cloudscape-design/components";
import { useCallback, useContext, useEffect, useState } from "react";
import {
  AdminUsersManagementAction,
  UserData,
  UserRole,
} from "../../../common/types";
import { ApiClient } from "../../../common/api-client/api-client";
import { useNavigate } from "react-router-dom";
import { AppContext } from "../../../common/app-context";
import { UserContext } from "../../../common/user-context";
import { getUserTableColumns } from "./users-table-columns";
import ManageUserModal from "./manage-user-modal";
import { UsersTableTextHelper } from "./users-table-text-helper";

export default function UsersTable() {
  const navigate = useNavigate();
  const appContext = useContext(AppContext);
  const userContext = useContext(UserContext);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserData[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserData[]>([]);
  const [currentlySelectedUser, setCurrentlySelectedUser] =
    useState<UserData>();
  const [isManageModalVisible, setIsManageModalVisible] = useState(false);
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
  const [adminAction, setAdminAction] = useState<AdminUsersManagementAction>(
    AdminUsersManagementAction.NO_ACTION
  );
  const [userEnabled, setUserEnabled] = useState(true);
  const [flashbarItems, setFlashbarItems] = useState<
    FlashbarProps.MessageDefinition[]
  >([]);

  const getUsers = useCallback(async () => {
    if (!appContext) return;
    if (!userContext || userContext.userRole != UserRole.ADMIN) {
      navigate("/");
    }
    setCurrentlySelectedUser(undefined);
    setSelectedUsers([]);
    const apiClient = new ApiClient(appContext);
    const result = await apiClient.adminUsers.getUsers();
    if (result.data?.listUsers) {
      setUsers([...(result.data.listUsers as UserData[])]);
    }
    setLoading(false);
  }, [
    appContext,
    userContext,
    setLoading,
    navigate,
    setCurrentlySelectedUser,
    setSelectedUsers,
  ]);

  const onDismissFlashbar = useCallback(
    async (id: string) => {
      setFlashbarItems(
        flashbarItems.filter((item) => {
          return item.id != id;
        })
      );
    },
    [setFlashbarItems, flashbarItems]
  );

  const createUser = useCallback(
    async (userData: UserData) => {
      if (!appContext) return;
      if (!userContext || userContext.userRole != UserRole.ADMIN) return;
      const apiClient = new ApiClient(appContext);
      const result = await apiClient.adminUsers.createUser(userData);
      setFlashbarItems([
        ...flashbarItems,
        UsersTableTextHelper.getFlashbar(
          AdminUsersManagementAction.CREATE,
          result.data?.createUser !== undefined,
          onDismissFlashbar
        ),
      ]);
      getUsers();
      setLoading(false);
    },
    [
      getUsers,
      appContext,
      userContext,
      setFlashbarItems,
      flashbarItems,
      onDismissFlashbar,
    ]
  );

  const updateUser = useCallback(
    async (userData: UserData) => {
      if (!appContext) return;
      if (!userContext || userContext.userRole != UserRole.ADMIN) return;
      const apiClient = new ApiClient(appContext);
      const result = await apiClient.adminUsers.updateUser(
        userData.name,
        userData.email,
        userData.role,
        userData.phoneNumber,
        userData.previousEmail
      );
      setFlashbarItems([
        ...flashbarItems,
        UsersTableTextHelper.getFlashbar(
          AdminUsersManagementAction.EDIT,
          result.data?.editUser !== undefined,
          onDismissFlashbar
        ),
      ]);
      getUsers();
      setCurrentlySelectedUser(undefined);
      setSelectedUsers([]);
      setLoading(false);
    },
    [
      getUsers,
      appContext,
      userContext,
      setLoading,
      setFlashbarItems,
      flashbarItems,
      onDismissFlashbar,
    ]
  );

  const resetUserPassword = useCallback(
    async (userData: UserData) => {
      if (!appContext) return;
      if (!userContext || userContext.userRole != UserRole.ADMIN) return;
      const apiClient = new ApiClient(appContext);
      const result = await apiClient.adminUsers.resetUserPassword(userData);
      setFlashbarItems([
        ...flashbarItems,
        UsersTableTextHelper.getFlashbar(
          AdminUsersManagementAction.RESET_PASSWORD,
          result.data?.resetUserPassword === true,
          onDismissFlashbar
        ),
      ]);
      getUsers();
      setLoading(false);
    },
    [
      getUsers,
      setLoading,
      userContext,
      appContext,
      setFlashbarItems,
      flashbarItems,
      onDismissFlashbar,
    ]
  );

  const disableUser = useCallback(
    async (userData: UserData) => {
      if (!appContext) return;
      if (!userContext || userContext.userRole != UserRole.ADMIN) return;
      setLoading(true);
      const apiClient = new ApiClient(appContext);
      const result = await apiClient.adminUsers.disableUser(userData);
      setFlashbarItems([
        ...flashbarItems,
        UsersTableTextHelper.getFlashbar(
          AdminUsersManagementAction.DISABLE,
          result.data?.toggleUser === true,
          onDismissFlashbar
        ),
      ]);
      getUsers();
      setLoading(false);
    },
    [
      appContext,
      userContext,
      getUsers,
      setLoading,
      setFlashbarItems,
      flashbarItems,
      onDismissFlashbar,
    ]
  );

  const enableUser = useCallback(
    async (userData: UserData) => {
      if (!appContext) return;
      if (!userContext || userContext.userRole != UserRole.ADMIN) return;
      setLoading(true);
      const apiClient = new ApiClient(appContext);
      const result = await apiClient.adminUsers.enableUser(userData);
      setFlashbarItems([
        ...flashbarItems,
        UsersTableTextHelper.getFlashbar(
          AdminUsersManagementAction.ENABLE,
          result.data?.toggleUser === true,
          onDismissFlashbar
        ),
      ]);
      getUsers();
      setLoading(false);
    },
    [
      appContext,
      userContext,
      getUsers,
      setLoading,
      setFlashbarItems,
      flashbarItems,
      onDismissFlashbar,
    ]
  );

  const deleteUser = useCallback(
    async (userData: UserData) => {
      if (!appContext) return;
      if (!userContext || userContext.userRole != UserRole.ADMIN) return;
      setLoading(true);
      const apiClient = new ApiClient(appContext);
      const result = await apiClient.adminUsers.deleteUser(userData);
      setFlashbarItems([
        ...flashbarItems,
        UsersTableTextHelper.getFlashbar(
          AdminUsersManagementAction.DELETE,
          result.data?.deleteUser === true,
          onDismissFlashbar
        ),
      ]);
      getUsers();
      setLoading(false);
    },
    [
      appContext,
      userContext,
      getUsers,
      setLoading,
      setFlashbarItems,
      flashbarItems,
      onDismissFlashbar,
    ]
  );

  const onDismiss = async () => {
    setAdminAction(AdminUsersManagementAction.NO_ACTION);
    setCurrentlySelectedUser(undefined);
    setSelectedUsers([]);
    setIsManageModalVisible(false);
    setIsConfirmModalVisible(false);
  };

  const onSave = async (userData: UserData) => {
    setIsManageModalVisible(false);
    setLoading(true);
    if (adminAction == AdminUsersManagementAction.CREATE) {
      createUser(userData);
    } else if (adminAction == AdminUsersManagementAction.EDIT) {
      updateUser(userData);
    }
  };

  useEffect(() => {
    getUsers();
  }, [getUsers]);

  const refreshUsers = async () => {
    setLoading(true);
    await getUsers();
  };

  const handleUserActions = (
    event: CustomEvent<ButtonDropdownProps.ItemClickDetails>
  ) => {
    const detail = event.detail;
    if (detail.id == "edit" && currentlySelectedUser) {
      setAdminAction(AdminUsersManagementAction.EDIT);
      setIsManageModalVisible(true);
    } else if (detail.id == "disable" && currentlySelectedUser) {
      setAdminAction(AdminUsersManagementAction.DISABLE);
      setIsConfirmModalVisible(true);
    } else if (detail.id == "enable" && currentlySelectedUser) {
      setAdminAction(AdminUsersManagementAction.ENABLE);
      enableUser(currentlySelectedUser);
      setCurrentlySelectedUser(undefined);
      setSelectedUsers([]);
    } else if (detail.id == "delete" && currentlySelectedUser) {
      setAdminAction(AdminUsersManagementAction.DELETE);
      setIsConfirmModalVisible(true);
    } else if (detail.id == "reset-password" && currentlySelectedUser) {
      setAdminAction(AdminUsersManagementAction.RESET_PASSWORD);
      setIsConfirmModalVisible(true);
    } else {
      setAdminAction(AdminUsersManagementAction.NO_ACTION);
    }
  };

  const handleAddUserClick = () => {
    setSelectedUsers([]);
    setCurrentlySelectedUser(undefined);
    setIsManageModalVisible(true);
    setAdminAction(AdminUsersManagementAction.CREATE);
  };

  const onUserSelectionChange = (
    detail: TableProps.SelectionChangeDetail<UserData>
  ) => {
    setSelectedUsers(detail.selectedItems);
    const selectedUser = detail.selectedItems[0];
    setCurrentlySelectedUser(selectedUser);
    if (selectedUser.enabled) {
      setUserEnabled(true);
    } else {
      setUserEnabled(false);
    }
  };

  const columnDefinitions = getUserTableColumns();

  return (
    <SpaceBetween direction="vertical" size="s">
      <Flashbar items={flashbarItems} />
      <Table
        loading={loading}
        columnDefinitions={columnDefinitions}
        loadingText="Loading Users"
        resizableColumns={true}
        selectedItems={selectedUsers}
        selectionType="single"
        onSelectionChange={({ detail }) => onUserSelectionChange(detail)}
        items={users}
        header={
          <Header
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={refreshUsers} />
                <Button variant="primary" onClick={handleAddUserClick}>
                  Add User
                </Button>
                <ButtonDropdown
                  onItemClick={(details) => handleUserActions(details)}
                  disabled={currentlySelectedUser == undefined}
                  items={[
                    {
                      id: "edit",
                      text: "Edit User",
                      iconName: "edit",
                      disabled: selectedUsers.length != 1,
                    },
                    {
                      id: "disable",
                      text: "Disable User",
                      iconName: "close",
                      disabled:
                        selectedUsers.length != 1 ||
                        !userEnabled ||
                        currentlySelectedUser?.email == userContext.userEmail,
                      disabledReason: currentlySelectedUser
                        ? UsersTableTextHelper.getDisableActionDisabledDescription(
                            currentlySelectedUser,
                            userContext.userEmail
                          )
                        : "",
                    },
                    {
                      id: "enable",
                      text: "Enable User",
                      iconName: "check",
                      disabled: selectedUsers.length != 1 || userEnabled,
                      disabledReason: currentlySelectedUser
                        ? UsersTableTextHelper.getEnableActionDisabledDescription(
                            currentlySelectedUser,
                            userContext.userEmail ?? ""
                          )
                        : "",
                    },
                    {
                      id: "delete",
                      text: "Delete User",
                      iconName: "delete-marker",
                      disabled: selectedUsers.length != 1 || userEnabled,
                      disabledReason: currentlySelectedUser
                        ? UsersTableTextHelper.getDeleteActionDisabledDescription(
                            currentlySelectedUser,
                            userContext.userEmail ?? ""
                          )
                        : "",
                    },
                    {
                      id: "reset-password",
                      text: "Reset Password",
                      iconName: "key",
                    },
                  ]}
                >
                  Actions
                </ButtonDropdown>
              </SpaceBetween>
            }
          />
        }
      />
      <Modal
        visible={isConfirmModalVisible}
        onDismiss={onDismiss}
        header={
          <Header>{UsersTableTextHelper.getConfirmHeader(adminAction)}</Header>
        }
        footer={
          <SpaceBetween size="s" direction="horizontal" alignItems="end">
            <Button onClick={onDismiss}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (adminAction == AdminUsersManagementAction.DELETE) {
                  if (currentlySelectedUser) {
                    deleteUser(currentlySelectedUser);
                    setCurrentlySelectedUser(undefined);
                    setSelectedUsers([]);
                    setIsConfirmModalVisible(false);
                    setAdminAction(AdminUsersManagementAction.NO_ACTION);
                  }
                } else if (adminAction == AdminUsersManagementAction.DISABLE) {
                  if (currentlySelectedUser) {
                    disableUser(currentlySelectedUser);
                    setCurrentlySelectedUser(undefined);
                    setSelectedUsers([]);
                    setIsConfirmModalVisible(false);
                    setAdminAction(AdminUsersManagementAction.NO_ACTION);
                  }
                } else if (
                  adminAction == AdminUsersManagementAction.RESET_PASSWORD
                ) {
                  if (currentlySelectedUser) {
                    resetUserPassword(currentlySelectedUser);
                    setCurrentlySelectedUser(undefined);
                    setSelectedUsers([]);
                    setIsConfirmModalVisible(false);
                    setAdminAction(AdminUsersManagementAction.NO_ACTION);
                  }
                }
              }}
            >
              {UsersTableTextHelper.getConfirmActionButton(adminAction)}
            </Button>
          </SpaceBetween>
        }
      >
        <Alert type="warning">
          {UsersTableTextHelper.getConfirmDescription(adminAction)}
        </Alert>
      </Modal>
      <ManageUserModal
        onDismiss={onDismiss}
        visible={isManageModalVisible}
        userData={currentlySelectedUser}
        onSave={onSave}
        key={currentlySelectedUser + "ManageUser"}
        adminAction={adminAction}
      />
    </SpaceBetween>
  );
}

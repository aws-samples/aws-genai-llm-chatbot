import { FlashbarProps } from "@cloudscape-design/components";
import { AdminUsersManagementAction, UserData } from "../../../common/types";

export class UsersTableTextHelper {
  static getConfirmHeader = (action: AdminUsersManagementAction): string => {
    switch (action) {
      case AdminUsersManagementAction.DISABLE:
        return "Disable User?";
      case AdminUsersManagementAction.DELETE:
        return "Delete User?";
      case AdminUsersManagementAction.RESET_PASSWORD:
        return "Reset Password?";
      default:
        return "Confirm?";
    }
  };

  static getConfirmDescription = (
    action: AdminUsersManagementAction
  ): string => {
    switch (action) {
      case AdminUsersManagementAction.DISABLE:
        return "Are you sure you want to disable this user? This user will no longer be able to login. The user can be enabled later and any user data will remain stored.";
      case AdminUsersManagementAction.DELETE:
        return "Are you sure you want to delete this user? This will delete all data associated with the user as well.";
      case AdminUsersManagementAction.RESET_PASSWORD:
        return "Are you sure you want to reset the password for this user? This will force the user to create a new password before they can access the site again.";
      default:
        return "Are you sure?";
    }
  };

  static getConfirmActionButton = (
    action: AdminUsersManagementAction
  ): string => {
    switch (action) {
      case AdminUsersManagementAction.DISABLE:
        return "Disable User";
      case AdminUsersManagementAction.DELETE:
        return "Delete User";
      case AdminUsersManagementAction.RESET_PASSWORD:
        return "Reset Password";
      default:
        return "Confirm";
    }
  };

  static getDisableActionDisabledDescription = (
    selectedUser: UserData,
    currentUserEmail: string
  ): string => {
    if (selectedUser.enabled && currentUserEmail == selectedUser.email) {
      return "You cannot disable your own user";
    } else {
      return "User is already disabled";
    }
  };

  static getEnableActionDisabledDescription = (
    selectedUser: UserData,
    currentUserEmail: string
  ): string => {
    if (selectedUser.enabled && currentUserEmail == selectedUser.email) {
      return "Your user is currently selected and is already enabled";
    } else {
      return "Selected user is already enabled";
    }
  };

  static getDeleteActionDisabledDescription = (
    selectedUser: UserData,
    currentUserEmail: string
  ): string => {
    if (currentUserEmail != selectedUser.email && selectedUser.enabled) {
      return "Selected user is not disabled - To delete a user, first disable the user, then delete the user";
    } else {
      return "You cannot delete your own user";
    }
  };

  static getFlashbar = (
    action: AdminUsersManagementAction,
    success: boolean,
    dismissItem: (id: string) => void
  ): FlashbarProps.MessageDefinition => {
    if (action == AdminUsersManagementAction.CREATE) {
      if (success) {
        const id = "user-created-" + Math.random().toString(36);
        return {
          type: "success",
          content: "User created successfully",
          header: "User Created",
          dismissible: true,
          id: id,
          onDismiss: () => {
            dismissItem(id);
          },
        };
      } else {
        const id = "user-creation-failed-" + Math.random().toString(36);
        return {
          type: "error",
          content:
            "The user was not created successfully. Please contact your administrator for support.",
          header: "User Creation Failed",
          dismissible: true,
          id: id,
          onDismiss: () => {
            dismissItem(id);
          },
        };
      }
    } else if (action == AdminUsersManagementAction.DELETE) {
      if (success) {
        const id = "user-deleted-" + Math.random().toString(36);
        return {
          type: "success",
          content: "User deleted successfully",
          header: "User Deleted",
          dismissible: true,
          id: id,
          onDismiss: () => {
            dismissItem(id);
          },
        };
      } else {
        const id = "user-deletion-failed-" + Math.random().toString(36);
        return {
          type: "error",
          content:
            "The user was not deleted successfully. Please contact your administrator for support.",
          header: "User Deletion Failed",
          dismissible: true,
          id: id,
          onDismiss: () => {
            dismissItem(id);
          },
        };
      }
    } else if (action == AdminUsersManagementAction.DISABLE) {
      if (success) {
        const id = "user-disabled-" + Math.random().toString(36);
        return {
          type: "success",
          content: "User disabled successfully",
          header: "User Disabled",
          dismissible: true,
          id: id,
          onDismiss: () => {
            dismissItem(id);
          },
        };
      } else {
        const id = "user-disable-failed-" + Math.random().toString(36);
        return {
          type: "error",
          content:
            "The user was not disabled successfully. Please contact your administrator for support.",
          header: "User Disable Failed",
          dismissible: true,
          id: id,
          onDismiss: () => {
            dismissItem(id);
          },
        };
      }
    } else if (action == AdminUsersManagementAction.ENABLE) {
      if (success) {
        const id = "user-enabled-" + Math.random().toString(36);
        return {
          type: "success",
          content: "User enabled successfully",
          header: "User Enabled",
          dismissible: true,
          id: id,
          onDismiss: () => {
            dismissItem(id);
          },
        };
      } else {
        const id = "user-enable-failed-" + Math.random().toString(36);
        return {
          type: "error",
          content:
            "The user was not enabled successfully. Please contact your administrator for support.",
          header: "User Enable Failed",
          dismissible: true,
          id: id,
          onDismiss: () => {
            dismissItem(id);
          },
        };
      }
    } else if (action == AdminUsersManagementAction.RESET_PASSWORD) {
      const id = "password-reset-success-" + Math.random().toString(36);
      if (success) {
        return {
          type: "success",
          content: "Password reset successfully for user",
          header: "Password Reset",
          dismissible: true,
          id: id,
          onDismiss: () => {
            dismissItem(id);
          },
        };
      } else {
        const id = "password-reset-failed-" + Math.random().toString(36);
        return {
          type: "error",
          content:
            "The password was not reset successfully. Please contact your administrator for support.",
          header: "Password Reset Failed",
          dismissible: true,
          id: id,
          onDismiss: () => {
            dismissItem(id);
          },
        };
      }
    } else {
      if (success) {
        const id = "user-updated-" + Math.random().toString(36);
        return {
          type: "success",
          content: "User updated successfully",
          header: "User Updated",
          dismissible: true,
          id: id,
          onDismiss: () => {
            dismissItem(id);
          },
        };
      } else {
        const id = "user-update-failed-" + Math.random().toString(36);
        return {
          type: "error",
          content:
            "The user was not updated successfully. Please contact your administrator for support.",
          header: "User Update Failed",
          dismissible: true,
          id: id,
          onDismiss: () => {
            dismissItem(id);
          },
        };
      }
    }
  };
}

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useUpdatePasswordMutation } from "../../redux/services/authApi";

type ChangePasswordForm = {
  newPassword: string;
  confirmPassword: string;
};

export default function ChangePassword() {
  const { user, logout } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const [updatePassword, { isLoading }] = useUpdatePasswordMutation();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ChangePasswordForm>();

  const getPasswordRequirements = (password: string) => {
    return {
      minLength: password.length >= 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[^A-Za-z0-9]/.test(password),
    };
  };

  const newPassword = watch("newPassword", "");
  const requirements = getPasswordRequirements(newPassword || "");

  const onSubmit = async (data: ChangePasswordForm) => {
    console.log("Submitting password change:", {
      newPassword: data.newPassword,
    });

    try {
      // Use .unwrap() to get the actual response or throw error
      const response = await updatePassword({
        new_password: data.newPassword,
      }).unwrap();

      console.log("Password update response:", response);

      toast.success("Password changed successfully");

      // Check if this was first login
      if (user?.is_first_logged_in) {
        console.log("First login - logging out and redirecting to login");
        await logout();
        navigate("/login");
      } else {
        console.log("Not first login - redirecting to dashboard");
        navigate("/dashboard");
      }
    } catch (error: any) {
      console.error("Password update error:", error);

      // Handle different error formats
      const errorMessage =
        error?.data?.message || error?.message || "Failed to update password";

      toast.error(errorMessage);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="w-full max-w-md bg-white p-6 rounded-2xl shadow-xl">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#0C4A6E]">Change Password</h1>
          <p className="text-sm text-gray-500 mt-1">
            {user?.is_first_logged_in
              ? "This is your first login. Please set a new password."
              : "Please set a new password."}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* New Password */}
          <div>
            <Label>New Password</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Enter new password"
                {...register("newPassword", {
                  required: "Password is required",
                  minLength: {
                    value: 8,
                    message: "Password must be at least 8 characters",
                  },
                  validate: {
                    hasUpperCase: (value) =>
                      /[A-Z]/.test(value) ||
                      "Must include at least one uppercase letter",
                    hasLowerCase: (value) =>
                      /[a-z]/.test(value) ||
                      "Must include at least one lowercase letter",
                    hasNumber: (value) =>
                      /[0-9]/.test(value) || "Must include at least one number",
                    hasSpecialChar: (value) =>
                      /[^A-Za-z0-9]/.test(value) ||
                      "Must include at least one special character",
                  },
                })}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-xs text-red-500 mt-1">
                {errors.newPassword.message}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <Label>Confirm Password</Label>
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Confirm new password"
              {...register("confirmPassword", {
                required: "Please confirm your password",
                validate: (value) =>
                  value === newPassword || "Passwords do not match",
              })}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-red-500 mt-1">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {newPassword && (
            <div className="mt-3 space-y-1 text-xs">
              <p
                className={
                  requirements.minLength ? "text-green-600" : "text-red-500"
                }
              >
                {requirements.minLength ? "✓" : "✗"} At least 8 characters
              </p>
              <p
                className={
                  requirements.hasUpperCase ? "text-green-600" : "text-red-500"
                }
              >
                {requirements.hasUpperCase ? "✓" : "✗"} One uppercase letter
              </p>
              <p
                className={
                  requirements.hasLowerCase ? "text-green-600" : "text-red-500"
                }
              >
                {requirements.hasLowerCase ? "✓" : "✗"} One lowercase letter
              </p>
              <p
                className={
                  requirements.hasNumber ? "text-green-600" : "text-red-500"
                }
              >
                {requirements.hasNumber ? "✓" : "✗"} One number
              </p>
              <p
                className={
                  requirements.hasSpecialChar
                    ? "text-green-600"
                    : "text-red-500"
                }
              >
                {requirements.hasSpecialChar ? "✓" : "✗"} One special character
              </p>
            </div>
          )}

          <div className="flex gap-5">
            {/* Submit */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#0C4A6E]"
            >
              {isLoading ? "Updating..." : "Update Password"}
            </Button>

            {/* Cancel button */}
            <Button
              type="button"
              onClick={async () => {
                await logout();
                navigate("/login");
              }}
              className="w-full bg-gray-300 font-medium text-gray-900 rounded-md hover:bg-gray-400"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

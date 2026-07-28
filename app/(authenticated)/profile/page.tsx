import { AvatarWithFrame } from "../../components/AvatarWithFrame";

export default function Profile() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">

      <div className="section-header">
        <span className="section-header-text">Profile</span>
      </div>

      <AvatarWithFrame
        avatarSrc="/user-profile/user-profile/default-avatar.webp"
        frameSrc="/user-profile/user-profile/default-avatar-frame.webp"
        innerSize={120}
      />

      <p className="max-w-sm text-sm leading-7 text-[#a89880]">
        Profile customization is coming soon.
      </p>
    </main>
  );
}

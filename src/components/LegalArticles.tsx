"use client";

import { useI18n } from "@/components/LanguageProvider";

export function PrivacyArticle() {
  const { locale } = useI18n();
  if (locale === "ko") {
    return (
      <article className="mx-auto max-w-3xl space-y-8 px-6 pb-24 pt-40 text-sm leading-7 text-neutral-800">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-black">개인정보 처리방침</h1>
          <p className="text-neutral-500">최종 업데이트 2026년 11월 24일</p>
        </header>
        <p>
          Aitch NYC는 초대받은 고객을 위한 비공개 매물 사이트입니다. 이 페이지는 무엇을 수집하는지, 왜 수집하는지, 누가 볼 수 있는지를 설명합니다.
        </p>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-black">운영 주체</h2>
          <p>
            이 사이트는 Aitch NYC가 운영합니다. 이 방침에 대한 문의는{" "}
            <a className="underline" href="mailto:wfulghum@gmail.com">
              wfulghum@gmail.com
            </a>
            으로 보내 주세요.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-black">계정</h2>
          <p>
            최고 관리자는 Google로 로그인합니다. 최고 관리자는 다른 관리자가 사용할 Google 이메일을 추가할 수도 있습니다. 그 사람이 로그인하면 이름, 이메일 주소, Google이 이메일을 확인했는지 여부를 받습니다. 다음 방문 때 알아볼 수 있도록 그 정보를 저장합니다. 그 관리자는 자신의 목록에 있는 매물과 고객을 봅니다. 관리자가 추가한 매물과 고객도 누가 추가했는지와 함께 마스터 목록에 남습니다. 최고 관리자가 마스터 기록을 숨기거나 삭제하면 그 관리자의 목록에서도 빠집니다.
          </p>
          <p>
            고객은 관리자가 추가합니다. 이메일은 선택입니다. 고객의 이름, 전화번호, 이메일이 있으면 이메일, 회사 웹사이트, 회사 우편번호, 회사 로고, 그리고 매물 페이지로 가는 비공개 링크를 저장합니다. 그 링크를 여는 데 Google 계정은 필요 없습니다. 링크를 가진 사람은 그 고객에게 배정된 매물을 볼 수 있습니다. 고객이 매물을 좋아요하면 관리자가 관심 매물을 볼 수 있도록 그 선택을 저장합니다. 좋아요한 매물의 투어 요청도 관리자가 후속할 수 있도록 저장합니다. Google이 허용되지 않은 관리자 이메일을 확인하면 계정을 만들지 않습니다.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-black">매물</h2>
          <p>
            관리자는 주소, 호수, 가격, 동네, 면적, 침실, 욕실, 편의시설, 설명, 임대·매매·상업용 여부, 사진, 영상 하나를 포함한 매물 정보를 저장합니다. 고객은 자신의 페이지에 있는 매물만 봅니다. 최고 관리자는 한 고객의 페이지와 PDF에서 임대 또는 매매 매물의 번지를 숨길 수 있습니다. 그 매물의 지도 핀은 남습니다. 관리자는 한 매물에 대해 고객에게 문서를 첨부할 수 있습니다. 그 고객은 매물에서 문서를 내려받을 수 있습니다. 다른 관리자는 자신의 목록에 있는 매물과 고객을 봅니다. 관리자가 자신이 추가한 항목의 글을 고치면 그 목록에 남습니다. 사진은 공유 매물에 남습니다.
          </p>
          <p>
            주소를 지도에 올리기 위해 호수를 뺀 도로명 주소를 미국 인구조사국 지오코더에 보내고, 필요하면 OpenStreetMap Nominatim에도 보냅니다. 지도 타일은 OpenStreetMap이 제공합니다.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-black">쿠키</h2>
          <p>
            로그인하면 14일 동안 로그인 상태를 유지하는 httpOnly 쿠키를 설정합니다. Google 로그인이 진행되는 동안에는 짧은 쿠키도 사용합니다. 이 쿠키는 사이트를 운영하기 위한 것이며 광고에 쓰지 않습니다.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-black">정보가 저장되는 곳</h2>
          <p>
            계정과 매물 기록은 Cloudflare D1에 저장됩니다. 사진과 영상은 Cloudflare R2에 저장됩니다. 사이트는 Cloudflare에서 제공됩니다. 개인정보를 판매하지 않습니다.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-black">보관 기간</h2>
          <p>
            관리자가 삭제할 때까지 계정과 매물 배정을 보관합니다.{" "}
            <a className="underline" href="mailto:wfulghum@gmail.com">
              wfulghum@gmail.com
            </a>
            으로 이메일을 보내 계정 삭제를 요청할 수 있습니다.
          </p>
        </section>
      </article>
    );
  }

  return (
    <article className="mx-auto max-w-3xl space-y-8 px-6 pb-24 pt-40 text-sm leading-7 text-neutral-800">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-black">Privacy policy</h1>
        <p className="text-neutral-500">Last updated November 24, 2026</p>
      </header>
      <p>
        Aitch NYC is a private listings site for invited clients. This page describes what we collect, why we collect it, and who can see it.
      </p>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-black">Who we are</h2>
        <p>
          The site is operated by Aitch NYC. Questions about this policy can be sent to{" "}
          <a className="underline" href="mailto:wfulghum@gmail.com">
            wfulghum@gmail.com
          </a>
          .
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-black">Accounts</h2>
        <p>
          Super admins sign in with Google. A super admin can also add another administrator by the Google email that person will use. When that person signs in, we receive their name, email address, and whether Google has verified that email. We store that information so we can recognize them on later visits. Those administrators see the listings and clients on their own list. Listings and clients they add are also kept on the master list, with a note of who added them. A super admin can hide or delete a master record, which removes it from that administrator&apos;s list as well.
        </p>
        <p>
          Clients are added by an administrator. Email is optional. We store the client&apos;s name, phone number, email when one is provided, company website, company zip code, and company logo, and a private link to their listings page. Opening that link does not require a Google account. Anyone with the link can see the listings assigned to that client. When a client likes a listing, we store that choice so an administrator can see which listings they are interested in. A tour request on a liked listing is stored so an administrator can follow up. If Google confirms an administrator email that is not allowed, we do not create an account.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-black">Listings</h2>
        <p>
          Administrators save listing details, including the address, unit, price, neighborhood, size, bedrooms, bathrooms, amenities, description, rental, sale, or commercial status, photos, and one video. Clients see only the listings on their page. A super admin can hide the street number of a rental or sale on one client&apos;s page and PDF. The map pin for that listing stays. Administrators can attach a document to a client for one listing. That client can download the document from the listing. Other administrators see the listings and clients on their own list. Text changes an administrator makes to something they added stay on their list. Photos stay with the shared listing.
        </p>
        <p>
          To place an address on the map, we send the street address, without the unit number, to the U.S. Census Bureau geocoder and, if needed, OpenStreetMap Nominatim. The map tiles are served by OpenStreetMap.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-black">Cookies</h2>
        <p>
          After you sign in, we set an httpOnly cookie that keeps you signed in for 14 days. A short-lived cookie is also used while Google sign-in is in progress. These cookies are used to operate the site, not to advertise.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-black">Where information is stored</h2>
        <p>
          Account and listing records are stored in Cloudflare D1. Photos and video are stored in Cloudflare R2. The site is served from Cloudflare. We do not sell personal information.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-black">How long we keep it</h2>
        <p>
          We keep an account and its listing assignments until an administrator deletes them. You can ask us to delete your account by emailing{" "}
          <a className="underline" href="mailto:wfulghum@gmail.com">
            wfulghum@gmail.com
          </a>
          .
        </p>
      </section>
    </article>
  );
}

export function TermsArticle() {
  const { locale } = useI18n();
  if (locale === "ko") {
    return (
      <article className="mx-auto max-w-3xl space-y-8 px-6 pb-24 pt-40 text-sm leading-7 text-neutral-800">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-black">이용약관</h1>
          <p className="text-neutral-500">최종 업데이트 2026년 11월 20일</p>
        </header>
        <p>이 약관은 Aitch NYC 웹사이트 이용에 적용됩니다. 로그인하거나 매물을 보면 이 약관에 동의한 것으로 봅니다.</p>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-black">비공개 매물</h2>
          <p>
            매물은 관리자가 초대한 사람에게만 공유됩니다. 초대받았다면 배정된 매물은 본인용입니다. 관리자가 서면으로 동의하지 않는 한 매물, 사진, 영상을 복사하거나 전달하거나 공개하지 마세요.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-black">계정</h2>
          <p>
            관리자는 Google로 로그인합니다. 고객은 비공개 페이지 링크를 받습니다. 그 링크는 배정된 매물만 보여 주며, 어떤 이메일로도 열립니다. 링크를 비공개로 유지하세요. 관리자는 언제든 접근을 거둘 수 있습니다.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-black">매물 정보</h2>
          <p>
            가격, 가능 여부, 그 밖의 내용은 바뀌거나 철회될 수 있습니다. 이 사이트의 매물은 그 자체로 수락할 수 있는 청약이 아니며, 매물이 아직 가능하다는 약속도 아닙니다.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-black">사이트</h2>
          <p>
            사이트는 있는 그대로 제공됩니다. 바꾸거나 중단할 수 있습니다. 법이 허용하는 범위에서, 접속이 끊기거나 매물 정보에 오류가 있거나 여기서 본 내용으로 내린 결정에 대해 책임지지 않습니다.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-black">문의</h2>
          <p>
            이 약관에 대한 문의는{" "}
            <a className="underline" href="mailto:wfulghum@gmail.com">
              wfulghum@gmail.com
            </a>
            으로 보내 주세요.
          </p>
        </section>
      </article>
    );
  }

  return (
    <article className="mx-auto max-w-3xl space-y-8 px-6 pb-24 pt-40 text-sm leading-7 text-neutral-800">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-black">Terms of service</h1>
        <p className="text-neutral-500">Last updated November 20, 2026</p>
      </header>
      <p>These terms cover use of the Aitch NYC website. By signing in or viewing a listing, you agree to them.</p>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-black">Private listings</h2>
        <p>
          Listings are shared only with people an administrator has invited. If you are invited, the listings assigned to you are for you. Do not copy, forward, or publish them, the photos, or the video, unless an administrator agrees in writing.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-black">Your account</h2>
        <p>
          Administrators sign in with Google. Clients receive a private page link. That link shows only the listings assigned to them, and it works with any email. Keep the link private. An administrator can remove access at any time.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-black">Listing information</h2>
        <p>
          Prices, availability, and other details can change or be withdrawn. A listing on this site is not an offer that can be accepted by itself, and it is not a promise that a property is still available.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-black">The site</h2>
        <p>
          The site is provided as it is. We may change or stop it. To the extent the law allows, we are not liable for lost access, errors in a listing, or decisions made from what you see here.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-black">Contact</h2>
        <p>
          Questions about these terms can be sent to{" "}
          <a className="underline" href="mailto:wfulghum@gmail.com">
            wfulghum@gmail.com
          </a>
          .
        </p>
      </section>
    </article>
  );
}

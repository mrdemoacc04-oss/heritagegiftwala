# Running the shop: owner's guide

Your control panel is at **`https://admin.heritagegiftwala.in`** (once the one-time address set-up in DEPLOY.md section 5 is done; until then it is `/admin` on the website).

**How customers buy:** they pick gifts, press **Buy on WhatsApp**, fill in their name, phone and address, and WhatsApp opens with the whole order already typed out (products, quantities, their details). When they press Send it arrives in your WhatsApp chat, and you confirm the price, delivery and payment there. No payment is taken on the website.

**First sign-in:** use the email and temporary password you were given. The panel makes you choose your own password and set up **two-step sign-in** (scan a QR code with Google Authenticator or a similar app, then type the 6-digit code). It then shows **10 recovery codes: save them somewhere safe**. Each works once if you lose your phone.

**Every sign-in after that:** email and password, then the 6-digit code from the app.

**Forgot your password?** Use the link on the sign-in page. A reset link is emailed to you; it works once and lasts 30 minutes. You will still need your app code afterwards.

Changes appear on the website straight away.

## The left menu

| Menu | What it is for |
| --- | --- |
| **Dashboard** | New orders, today's and this week's sales, products running low |
| **Orders** | Every order, with search and filters. Open one to pack, ship and track it |
| **Products** | Add products, change prices, MRP and stock, switch prices on or off, upload photos |
| **Shelves** | The groups customers browse (Soft Toys, Lamps & Clocks…): add, rename, reorder, recolour, delete |
| **Coupons** | Discount codes |
| **Sale popup** | The box that pops up on the shop to announce a sale: write it, preview it, switch it on or off |
| **Settings** | A switch to hide every price on the shop, and the delivery charges |
| **My login** | Change your password, manage two-step sign-in and recovery codes, sign out of every device, and see recent sign-ins (a good place to spot anything odd) |

## Change a price or the stock
**Products**: type the new price or stock number in that product's row and press **Save**. Done.

**Prices are optional, and you can switch each one on or off.**
- **Price empty** = no price: the shop says "Message us for today's price" and customers press Buy on WhatsApp.
- **Price typed + "Show the price on the shop" switch ON** = the price shows on the shop straight away.
- **Price typed + switch OFF** = the price stays saved but is hidden (same "Price on WhatsApp" wording). Handy for keeping your numbers while you decide. In the **Products** list the small **Show** switch next to each price does the same, so you can turn prices on one by one.
- **Settings → "Show prices on the shop"** hides every price at once, whatever each product's own switch says. A price shows only when both switches are on.

**MRP:** on a product's own page, type the printed MRP (it must be higher than the selling price). The shop then shows it crossed out beside your price, with "25% off" on the tile and "You save 25%" on the product page. Leave it empty for no MRP. It is hidden whenever the price is hidden.

## Add a new product
**Products → Add a product.**
1. Give it a name and how many you have. The price is optional (see above).
2. Upload a **main photo**. The preview on the right shows how it will look on the shop.
3. Choose how the photo sits on its tile:
   - **Fill the tile**: for ordinary photos, such as ones from your phone. They are cropped to fit.
   - **Cut-out on a coloured tile**: only for photos with no background (a transparent PNG). Pick a tile colour you like.
4. Tick the **shelf** it belongs to and, if you like, who it is for and what occasion (that feeds the Gift Finder).
5. Press **Add product**. It is live straight away.

Set a product to **Draft** to hide it without deleting it. When stock reaches 0 the shop shows it as **sold out** by itself, and every order lowers the stock automatically.

## When an order arrives
Orders arrive as WhatsApp messages. To follow one through (and let the customer track it), enter it under **Orders → Take an order**; it then shows on the Dashboard and under **Orders**. Open it, then:
1. **Mark as packed** when it is ready.
2. Enter the **courier** and **tracking number** (and link, if there is one) and press *Save courier details*. The customer sees this on their tracking page.
3. **Mark as shipped** when the courier takes it.
4. **Mark as delivered** when it arrives, and **Mark as paid** once you've received the cash.

**Cancel order** puts the items back into stock. A delivered order can't be cancelled.

## Take an order yourself
**Orders → Take an order** (also on the Dashboard): for phone, WhatsApp or in-shop orders. Choose the products, enter the customer's details and place it. It follows the same rules as a website order: stock comes off and the customer can track it. A product with no price can't be put in an order: give it a price first.

## Coupons
**Coupons → New coupon**: a code (like `DIWALI10`), percent or rupees off, an optional minimum, a limit on uses and a last day. Pause or delete a coupon any time. A coupon discounts the items, not the delivery.

By default each coupon works **once per customer** (the same email or phone number can't use it twice, even if they add dots or `+something` to the email). Untick *One use per customer* for a code you want people to be able to reuse. Free delivery is judged on the amount the customer pays after the coupon.

## Shelves
**Shelves**: type a name and a web address (like `rakhi-festive`), pick a colour, a short line and a **cover product** (the picture on the homepage) and press **Add shelf**. Each shelf in the list can be renamed, reordered (smaller numbers first), recoloured, given another cover, or deleted. Changing a shelf's web address moves its products over and breaks old links to it. Deleting a shelf keeps its products in the shop; they just come off that shelf. To put a product on a shelf, tick it in the **Shelves** box on that product's page.

## Sale popup
**Sale popup**: a box that appears on the shop a few seconds after someone arrives, to announce a sale.
1. Write a **heading** (required), an optional small **sticker** (like `DIWALI SALE`), a line or two of text, and optionally a button: its label and where it goes (`whatsapp` for a chat with the shop, a page like `/shop`, or a full `https://` address). Add a picture and pick a colour if you like. The preview on the right shows exactly how it will look.
2. Choose **how many seconds** it waits, **how many days** it stays away after someone closes it, and optionally a **last day** after which it switches itself off.
3. Switch **The popup is ON** and press **Save popup**. It shows within a minute.

To end a sale, switch it OFF and save (your words stay saved for next time). When you change the popup and save it again, people who had closed the old one see the new one once. It never shows on the checkout page.

## Delivery charges
**Settings → Delivery charges**: standard price, express price, and the order value from which standard delivery is free (0 turns free delivery off).

## How customers track an order
**Track order** in the site menu: order number plus the email on the order (orders you enter under **Take an order**). They see Placed → Packed → On its way → Delivered, and your courier details. Customers with an account also see their orders under **Account**.

## Good to know
- Payment is arranged on WhatsApp for now. Online payment (UPI, cards) can be added later.
- Customers don't get automatic emails yet. They have their order number and the tracking page.
- If a customer forgets their account password there is no reset-by-email yet. Ask the person who set up the site.
- Lost your phone? Use one of your recovery codes at the code step, then set up two-step sign-in again under **My login**. If you have no codes either, the person who set up the site can reset it from their computer.
- If you see a sign-in you don't recognise under **My login → Recent activity**, press **Sign out everywhere** and change your password.

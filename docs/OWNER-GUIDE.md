# Running the shop: owner's guide

Your control panel is the **Medusa admin**. It lives at `https://<your-backend>.onrender.com/app` (the same Render service that holds the shop). Sign in with the email and password set in `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

Changes show on the website within about a minute.

## Change a price
**Products** → click the product → under **Variants** click the variant → **Prices** → edit the INR price → Save.
To show a crossed-out "was" price, use **Price Lists** → create a sale list with the lower price.

## Update stock
**Inventory** → click the item → edit **In stock** for "Heritage Gift Wala, Patan" → Save.
When stock reaches 0 the product shows as sold out on the site. Every order lowers stock automatically.

## Add a new product
**Products → Create**
1. Title, subtitle, description and a handle (the web address, e.g. `plush-panda`).
2. **Media**: upload photos. The **thumbnail** should be the transparent cut-out PNG, image 2 the studio shot, image 3 the shelf photo.
3. **Organize**: pick the category (shelf).
4. **Variants**: keep one variant called "Default", tick **Manage inventory**, set the INR price.
5. **Metadata** (optional, makes the Gift Finder and tiles work): `tint` (e.g. `#E6DEFF`), `badge` (e.g. `New`), `recipients` (`her,him,kids,parents,colleague,home`), `occasions` (`birthday,anniversary,festive,housewarming,thank-you,just-because`), `details` (points separated by ` | `), `rank` (lower number shows first).
6. Publish, then set its stock under **Inventory**.

To hide a product without deleting it, set its status to **Draft**.

## Handle an order
Customers get an order number (#12). Open it under **Orders**.
1. **Fulfil items** when you've packed it. The customer's tracking page changes to *Packed*.
2. **Mark as shipped** and enter the courier's **tracking number** (and tracking link, if any). The page changes to *On its way* and shows the number.
3. **Mark as delivered** when it arrives.
4. For cash on delivery, press **Capture payment** once you've been paid. The page then reads *Paid*.

To cancel an order, use the **⋯** menu on the order.

## Take an order yourself (phone, WhatsApp, in the shop)
**Orders → Drafts → Create draft order**: pick products, add the customer's email and address, choose delivery, then **Send as order**. It joins the normal flow above, and the customer can track it with the order number and email you entered.

## How customers track an order
**Track order** in the site's menu → order number + the email used at checkout. They see Placed → Packed → On its way → Delivered, plus the courier number you entered.

## Delivery charges
**Settings → Locations & Shipping → Heritage Gift Wala, Patan → India** → edit *Standard* or *Express* prices. The "free over ₹999" rule is a conditional price on Standard delivery. If you change these, also update the numbers in `storefront/src/lib/site.ts` so the site's free-delivery bar and Help page agree.

## Good to know
- Medusa does not send customer emails yet. Tell customers their number, or add an email provider later.
- Payment is cash on delivery. Online payment (Razorpay/UPI) needs a payment provider added to the backend.
- Add staff under **Settings → Users** (invite by email).

## Customer accounts
Customers can sign up on the website. Find them under **Customers** in the admin panel (name, email, saved addresses and their orders). Their order history on the site comes from the orders they placed while signed in. Customers who check out as guests have no account; you can still find their orders under **Orders**.

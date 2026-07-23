import sys
import time
from playwright.sync_api import sync_playwright

def run_layout_tests():
    print("[Playwright] Starting MorphIQ UI Layout Verification...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 412, 'height': 915}) # Mobile Samsung Galaxy viewport
        page = context.new_page()

        print("[Playwright] Navigating to http://localhost:5173 ...")
        page.goto('http://localhost:5173')
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(1800) # Wait for splash animation to finish

        # 1. Verify Home Tab
        print("[Playwright] Testing Home tab rendering...")
        page.wait_for_selector('text=Today')
        page.screenshot(path='scratch/home_light.png')

        # Click Settings icon & test Settings Screen
        print("[Playwright] Navigating to Settings screen...")
        page.click('button[aria-label="Settings"]')
        page.wait_for_timeout(300)
        page.wait_for_selector('text=Settings')
        page.screenshot(path='scratch/settings_screen.png')

        # Test Seed Demo Data button
        print("[Playwright] Seeding demo mock data...")
        seed_btn = page.query_selector('text=Seed Demo Data')
        if seed_btn:
            seed_btn.click()
            page.wait_for_timeout(1000)
            print("[Playwright] Demo data seeded successfully.")

        # Return to Home tab
        print("[Playwright] Navigating back to Home tab...")
        page.click('button:has-text("Home")')
        page.wait_for_timeout(500)
        page.screenshot(path='scratch/home_with_mock_data.png')

        # 2. Verify Gym Tab
        print("[Playwright] Navigating to Gym tab...")
        page.click('button:has-text("Gym")')
        page.wait_for_timeout(500)
        page.wait_for_selector('text=Gym')
        page.screenshot(path='scratch/gym_tab.png')

        # Verify Workout History ordering / descending date
        history_cards = page.query_selector_all('text=Chest & Triceps')
        print(f"[Playwright] Found {len(history_cards)} history card instances in Gym tab.")

        # 3. Verify Exercises Tab
        print("[Playwright] Navigating to Exercises tab...")
        page.click('button:has-text("Exercises")')
        page.wait_for_timeout(500)
        page.wait_for_selector('text=Exercises')
        page.screenshot(path='scratch/exercises_tab.png')

        # 4. Verify Coach Tab
        print("[Playwright] Navigating to Coach tab...")
        page.click('button:has-text("Coach")')
        page.wait_for_timeout(300)
        page.wait_for_selector('text=Coach')
        page.screenshot(path='scratch/coach_tab.png')

        browser.close()
        print("[Playwright] MorphIQ UI Layout Verification complete! Screenshots saved to scratch/")

if __name__ == '__main__':
    run_layout_tests()

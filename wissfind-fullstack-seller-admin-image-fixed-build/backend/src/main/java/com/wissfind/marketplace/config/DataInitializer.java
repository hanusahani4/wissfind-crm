package com.wissfind.marketplace.config;

import com.wissfind.marketplace.entity.Product;
import com.wissfind.marketplace.entity.User;
import com.wissfind.marketplace.repo.ProductRepository;
import com.wissfind.marketplace.repo.UserRepository;
import com.wissfind.marketplace.entity.Category;
import com.wissfind.marketplace.repo.CategoryRepository;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DataInitializer {

    @Bean
    CommandLineRunner seed(
            UserRepository users,
            ProductRepository products,
            PasswordEncoder enc, CategoryRepository categories) {

        return args -> {

            // Seed shared category tree
            if (categories.count() == 0) {
                seedCategory(categories,"Fashion","fashion",new String[]{"Men","Women","Kids","Accessories","Footwear","Bags","Watches","Jewellery","Ethnic Wear","Western Wear","Sportswear"});
                seedCategory(categories,"Electronics","electronics",new String[]{"Smartphones","Mobiles","Laptops","Tablets","Audio","Smartwatches","Wearables","Speakers","Cameras","TVs & Displays","TV & Entertainment","Gaming","Accessories"});
                seedCategory(categories,"Home & Living","home-living",new String[]{"Furniture","Kitchen","Home Decor","Bedding","Lighting","Storage","Appliances"});
                seedCategory(categories,"Beauty","beauty",new String[]{"Makeup","Skincare","Haircare","Fragrance","Personal Care"});
                seedCategory(categories,"Sports & Fitness","sports-fitness",new String[]{"Gym","Running","Cricket","Football","Yoga","Outdoor","Sportswear"});
                seedCategory(categories,"Books & Stationery","books-stationery",new String[]{"Books","School","Office","Art & Craft"});
                seedCategory(categories,"Grocery","grocery",new String[]{"Staples","Snacks","Beverages","Packaged Food","Household"});
                seedCategory(categories,"Travel","travel",new String[]{"Luggage","Backpacks","Travel Accessories","Outdoor Travel"});
            }
        };
    }

    private static void seedCategory(CategoryRepository repo,String name,String slug,String[] children){
        Category root=new Category(); root.name=name; root.slug=slug; root.active=true; root=repo.save(root);
        for(String child:children){Category c=new Category();c.name=child;c.slug=slug+"-"+child.toLowerCase().replaceAll("[^a-z0-9]+","-");c.parent=root;c.active=true;repo.save(c);}
    }
}
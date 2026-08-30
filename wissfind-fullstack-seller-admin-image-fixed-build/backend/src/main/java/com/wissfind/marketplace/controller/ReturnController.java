package com.wissfind.marketplace.controller;
import com.wissfind.marketplace.entity.*; import com.wissfind.marketplace.repo.*; import com.wissfind.marketplace.service.CurrentUser; import org.springframework.security.access.prepost.PreAuthorize; import org.springframework.web.bind.annotation.*; import java.util.*;
@RestController @RequestMapping("/api/returns") public class ReturnController { final ReturnRequestRepository repo; final OrderRepository orders; final UserRepository users; public ReturnController(ReturnRequestRepository r,OrderRepository o,UserRepository u){repo=r;orders=o;users=u;}
 @GetMapping("/mine") @PreAuthorize("hasRole('CUSTOMER')") public List<ReturnRequest> mine(){return repo.findAll().stream().filter(x->x.customer.id.equals(CurrentUser.id())).toList();}
 @GetMapping("/mine/paged") @PreAuthorize("hasRole('CUSTOMER')") @org.springframework.transaction.annotation.Transactional(readOnly=true)
 public org.springframework.data.domain.Page<ReturnRequest> minePaged(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size,@RequestParam(defaultValue="All") String filter){
  int p=Math.max(0,page), s=Math.min(50,Math.max(1,size));
  var pageable=org.springframework.data.domain.PageRequest.of(p,s,org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC,"createdAt"));
  var spec=com.wissfind.marketplace.repo.SearchSpec.<ReturnRequest>eqPath("customer.id",CurrentUser.id());
  if("Return".equalsIgnoreCase(filter)) {
   spec=spec.and(com.wissfind.marketplace.repo.SearchSpec.<ReturnRequest>eq("requestType", ReturnRequest.RequestType.RETURN));
  } else if("Cancellation".equalsIgnoreCase(filter)) {
   spec=spec.and(com.wissfind.marketplace.repo.SearchSpec.<ReturnRequest>eq("requestType", ReturnRequest.RequestType.CANCELLATION));
  }
  return repo.findAll(spec,pageable);
 }
 @GetMapping("/seller") @PreAuthorize("hasRole('SELLER')") public List<ReturnRequest> seller(){return repo.findAll().stream().filter(x->x.order.seller.id.equals(CurrentUser.id())).toList();}
 @GetMapping @PreAuthorize("hasRole('ADMIN')") public List<ReturnRequest> all(){return repo.findAll();}
 @PostMapping @PreAuthorize("hasRole('CUSTOMER')") public ReturnRequest create(@RequestBody ReturnRequest r){r.id=null;r.order=orders.findById(r.order.id).orElseThrow();r.customer=users.findById(CurrentUser.id()).orElseThrow();if(repo.existsByOrderId(r.order.id))throw new IllegalArgumentException("Return request already exists for this order");r.status=ReturnRequest.Status.REQUESTED;r.requestType=ReturnRequest.RequestType.RETURN;return repo.save(r);}
 @PatchMapping("/{id}/status") @PreAuthorize("hasAnyRole('SELLER','ADMIN')") public ReturnRequest status(@PathVariable Long id,@RequestParam String value){var r=repo.findById(id).orElseThrow();r.status=ReturnRequest.Status.valueOf(value.toUpperCase().replace(' ','_'));return repo.save(r);}
}
